import { clamp, stopDifference } from "./lighting-core";

export type FacePosition = "auto" | "left" | "center" | "right";

export type PhotoReading = {
  faceLuminance: number;
  environmentLuminance: number;
  faceLevel: number;
  environmentLevel: number;
  imageKelvin: number;
  method: "face-detector" | "manual-zone";
  facePosition: FacePosition;
  warning: string;
};

export type PhotoMatch = {
  faceCorrectionStops: number;
  environmentCorrectionStops: number;
  kelvinShift: number;
  targetCct: number;
  currentCct: number;
};

type FaceBox = { x: number; y: number; width: number; height: number };
type BrowserFaceDetector = {
  detect(source: CanvasImageSource): Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};
type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => BrowserFaceDetector;

const MAX_FILE_SIZE = 16 * 1024 * 1024;
const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function validateImageFile(file: File) {
  if (!SUPPORTED_TYPES.has(file.type))
    return "只支持 JPG、PNG、WebP 或 HEIC 照片。";
  if (file.size > MAX_FILE_SIZE) return "照片不能超过 16MB。";
  return null;
}

const srgbToLinear = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const manualBox = (
  position: Exclude<FacePosition, "auto">,
  width: number,
  height: number,
): FaceBox => {
  const boxWidth = width * 0.3;
  const boxHeight = Math.min(height * 0.58, boxWidth * 1.55);
  const x =
    position === "left"
      ? width * 0.08
      : position === "right"
        ? width * 0.62
        : width * 0.35;
  return {
    x: clamp(x, 0, width - boxWidth),
    y: height * 0.12,
    width: boxWidth,
    height: boxHeight,
  };
};

async function detectFace(
  canvas: HTMLCanvasElement,
): Promise<FaceBox | null> {
  const FaceDetectorApi = (
    globalThis as typeof globalThis & { FaceDetector?: FaceDetectorConstructor }
  ).FaceDetector;
  if (!FaceDetectorApi) return null;
  try {
    const detector = new FaceDetectorApi({ fastMode: true, maxDetectedFaces: 5 });
    const faces = await detector.detect(canvas);
    const largest = faces.sort(
      (a, b) =>
        b.boundingBox.width * b.boundingBox.height -
        a.boundingBox.width * a.boundingBox.height,
    )[0];
    if (!largest) return null;
    const { x, y, width, height } = largest.boundingBox;
    return { x, y, width, height };
  } catch {
    return null;
  }
}

function estimateCct(red: number, green: number, blue: number) {
  const sum = Math.max(0.0001, red + green + blue);
  const r = red / sum;
  const g = green / sum;
  const b = blue / sum;
  const xValue = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const yValue = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const zValue = r * 0.0193 + g * 0.1192 + b * 0.9505;
  const xyz = Math.max(0.0001, xValue + yValue + zValue);
  const x = xValue / xyz;
  const y = yValue / xyz;
  const n = (x - 0.332) / Math.max(0.0001, 0.1858 - y);
  const cct =
    -449 * n ** 3 + 3525 * n ** 2 - 6823.3 * n + 5520.33;
  return Math.round(clamp(cct, 2500, 10000) / 100) * 100;
}

export async function analyzePhoto(
  file: File,
  facePosition: FacePosition = "auto",
): Promise<PhotoReading> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("照片解码失败，请换一张照片。"));
      image.src = objectUrl;
    });

    const width = Math.min(640, Math.max(1, image.naturalWidth));
    const height = Math.max(
      1,
      Math.round((image.naturalHeight / image.naturalWidth) * width),
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("浏览器无法读取照片像素。");
    context.drawImage(image, 0, 0, width, height);

    const detected = facePosition === "auto" ? await detectFace(canvas) : null;
    const fallbackPosition = facePosition === "auto" ? "center" : facePosition;
    const box = detected ?? manualBox(fallbackPosition, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let faceLuma = 0;
    let faceCount = 0;
    let environmentLuma = 0;
    let environmentCount = 0;
    let neutralRed = 0;
    let neutralGreen = 0;
    let neutralBlue = 0;
    let neutralCount = 0;

    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;
    const excludePaddingX = box.width * 0.24;
    const excludePaddingY = box.height * 0.18;

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const index = (y * width + x) * 4;
        if (pixels[index + 3] < 240) continue;
        const red = srgbToLinear(pixels[index]);
        const green = srgbToLinear(pixels[index + 1]);
        const blue = srgbToLinear(pixels[index + 2]);
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        const ellipse =
          ((x - faceCenterX) / (box.width / 2)) ** 2 +
          ((y - faceCenterY) / (box.height / 2)) ** 2;
        const isFace = ellipse <= 1;
        const isNearFace =
          x >= box.x - excludePaddingX &&
          x <= box.x + box.width + excludePaddingX &&
          y >= box.y - excludePaddingY &&
          y <= box.y + box.height + excludePaddingY;

        if (isFace) {
          faceLuma += luminance;
          faceCount += 1;
        } else if (!isNearFace) {
          environmentLuma += luminance;
          environmentCount += 1;
          const maxChannel = Math.max(red, green, blue);
          const minChannel = Math.min(red, green, blue);
          if (
            luminance > 0.04 &&
            luminance < 0.8 &&
            maxChannel - minChannel < 0.18
          ) {
            neutralRed += red;
            neutralGreen += green;
            neutralBlue += blue;
            neutralCount += 1;
          }
        }
      }
    }

    const face = faceLuma / Math.max(1, faceCount);
    const environment = environmentLuma / Math.max(1, environmentCount);
    const imageKelvin =
      neutralCount >= 20
        ? estimateCct(
            neutralRed / neutralCount,
            neutralGreen / neutralCount,
            neutralBlue / neutralCount,
          )
        : 5600;
    const method = detected ? "face-detector" : "manual-zone";

    return {
      faceLuminance: face,
      environmentLuminance: environment,
      faceLevel: Math.round(Math.sqrt(clamp(face, 0, 1)) * 100),
      environmentLevel: Math.round(
        Math.sqrt(clamp(environment, 0, 1)) * 100,
      ),
      imageKelvin,
      method,
      facePosition: detected ? "auto" : fallbackPosition,
      warning: detected
        ? "已自动找到画面中面积最大的人脸。"
        : "当前浏览器未识别人脸，已按人物位置框选；请确认位置。",
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function comparePhotos(
  previous: PhotoReading,
  current: PhotoReading,
): PhotoMatch {
  return {
    // Very dark pixels are dominated by compression/noise. A bounded result
    // remains actionable on set and prevents one bad photo from exploding the
    // lighting recommendation.
    faceCorrectionStops: clamp(
      stopDifference(previous.faceLuminance, current.faceLuminance),
      -6,
      6,
    ),
    environmentCorrectionStops: clamp(
      stopDifference(
        previous.environmentLuminance,
        current.environmentLuminance,
      ),
      -6,
      6,
    ),
    kelvinShift: previous.imageKelvin - current.imageKelvin,
    targetCct: previous.imageKelvin,
    currentCct: current.imageKelvin,
  };
}
