import type { FixtureProfile } from "./lighting-data";

export type CurveMode = "linear" | "native" | "calibrated";

export type CalibrationPoint = {
  setting: number;
  output: number;
};

export type LightingInput = {
  fixture: FixtureProfile;
  iso: number;
  aperture: number;
  fps: number;
  shutterAngle: number;
  ndStops: number;
  exposureCompensationStops: number;
  faceCorrectionStops: number;
  environmentCorrectionStops: number;
  ambientLux: number;
  ambientCct: number;
  targetCct: number;
  distance: number;
  lampHeight: number;
  subjectHeight: number;
  lightCount: number;
  modifierLossStops: number;
  currentPower: number;
  curveMode: CurveMode;
  calibration: CalibrationPoint[];
  meterLux: number | null;
};

export type CctRecommendation = {
  lampCct: number;
  effectiveCct: number;
  gel: string;
  gelLossStops: number;
  note: string;
};

export type LightingResult = {
  shutterSpeed: number;
  requiredLux: number;
  actualDistance: number;
  referenceLux: number;
  fullKeyLux: number;
  currentKeyLux: number;
  totalLux: number;
  requiredKeyLux: number;
  suggestedPower: number;
  powerRange: [number, number];
  subjectDeltaStops: number;
  keyToAmbientStops: number | null;
  environmentTargetLux: number;
  environmentFillLux: number;
  environmentSuggestedPower: number;
  confidence: "高" | "中" | "低";
  confidenceReason: string;
  cct: CctRecommendation;
  status: "ready" | "ambient-too-bright" | "underpowered";
};

const INCIDENT_METER_CONSTANT = 340;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const stopDifference = (value: number, target: number) =>
  Math.log2(Math.max(value, 0.0001) / Math.max(target, 0.0001));

export const signedStop = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)} 档`;

export const shutterSpeedFromAngle = (fps: number, shutterAngle: number) =>
  Math.max(1, fps * (360 / Math.max(1, shutterAngle)));

export function incidentLuxForExposure({
  iso,
  aperture,
  shutterSpeed,
  compensationStops,
}: {
  iso: number;
  aperture: number;
  shutterSpeed: number;
  compensationStops: number;
}) {
  // Sekonic incident-meter equation: E = C × N² / (ISO × t),
  // using C=340 for a standard lumisphere and t=1/shutterSpeed.
  return (
    (INCIDENT_METER_CONSTANT * aperture ** 2 * shutterSpeed) /
    Math.max(1, iso) *
    2 ** compensationStops
  );
}

export function interpolatePhotometrics(
  fixture: FixtureProfile,
  cct: number,
) {
  const points = [...fixture.photometricsByCct].sort((a, b) => a.cct - b.cct);
  if (!points.length) return fixture.referenceLux;
  if (cct <= points[0].cct) return points[0].lux;
  if (cct >= points[points.length - 1].cct)
    return points[points.length - 1].lux;
  const upperIndex = points.findIndex((point) => point.cct >= cct);
  const low = points[upperIndex - 1];
  const high = points[upperIndex];
  const progress = (cct - low.cct) / (high.cct - low.cct);
  return low.lux + (high.lux - low.lux) * progress;
}

const normalizedCurve = (calibration: CalibrationPoint[]) => {
  const cleaned = calibration
    .filter(
      (point) =>
        Number.isFinite(point.setting) &&
        Number.isFinite(point.output) &&
        point.setting > 0 &&
        point.setting < 100 &&
        point.output > 0 &&
        point.output < 100,
    )
    .sort((a, b) => a.setting - b.setting);
  return [
    { setting: 0, output: 0 },
    ...cleaned,
    { setting: 100, output: 100 },
  ];
};

export function outputFractionAtSetting(
  setting: number,
  mode: CurveMode,
  calibration: CalibrationPoint[],
) {
  const normalized = clamp(setting, 0, 100);
  if (mode !== "calibrated" || calibration.length === 0)
    return normalized / 100;
  const points = normalizedCurve(calibration);
  const upperIndex = points.findIndex((point) => point.setting >= normalized);
  const low = points[Math.max(0, upperIndex - 1)];
  const high = points[Math.max(1, upperIndex)];
  const progress = (normalized - low.setting) / (high.setting - low.setting);
  return (low.output + (high.output - low.output) * progress) / 100;
}

export function settingForOutputFraction(
  fraction: number,
  mode: CurveMode,
  calibration: CalibrationPoint[],
) {
  if (!Number.isFinite(fraction)) return Number.POSITIVE_INFINITY;
  if (fraction <= 0) return 0;
  // Keep values above 100% visible. Clamping here previously made the
  // `underpowered` state impossible to reach and hid how far short a lamp was.
  if (fraction > 1) return fraction * 100;
  const target = fraction * 100;
  if (mode !== "calibrated" || calibration.length === 0) return target;
  const points = normalizedCurve(calibration).sort((a, b) => a.output - b.output);
  const upperIndex = points.findIndex((point) => point.output >= target);
  const low = points[Math.max(0, upperIndex - 1)];
  const high = points[Math.max(1, upperIndex)];
  const span = high.output - low.output;
  if (Math.abs(span) < 0.0001) return high.setting;
  const progress = (target - low.output) / span;
  return low.setting + (high.setting - low.setting) * progress;
}

function nearestGel(deltaMired: number) {
  if (deltaMired >= 105)
    return { label: "Full CTO", loss: 1, shift: 131 };
  if (deltaMired >= 60)
    return { label: "1/2 CTO", loss: 0.5, shift: 82 };
  if (deltaMired >= 24)
    return { label: "1/4 CTO", loss: 0.25, shift: 42 };
  if (deltaMired <= -105)
    return { label: "Full CTB", loss: 1.2, shift: -131 };
  if (deltaMired <= -60)
    return { label: "1/2 CTB", loss: 0.7, shift: -82 };
  if (deltaMired <= -24)
    return { label: "1/4 CTB", loss: 0.35, shift: -42 };
  return { label: "无色纸", loss: 0, shift: 0 };
}

export function recommendCct({
  fixture,
  targetCct,
  ambientCct,
  ambientLux,
  keyLux,
}: {
  fixture: FixtureProfile;
  targetCct: number;
  ambientCct: number;
  ambientLux: number;
  keyLux: number;
}): CctRecommendation {
  const target = clamp(targetCct, 2000, 12000);
  const ambient = clamp(ambientCct, 2000, 12000);
  const safeKey = Math.max(1, keyLux);
  const targetMired = 1_000_000 / target;
  const ambientMired = 1_000_000 / ambient;
  const desiredLampMired =
    (targetMired * (Math.max(0, ambientLux) + safeKey) -
      ambientMired * Math.max(0, ambientLux)) /
    safeKey;
  const desiredLampCct = clamp(
    1_000_000 / Math.max(70, desiredLampMired),
    2000,
    12000,
  );

  if (fixture.cctMin !== fixture.cctMax) {
    const lampCct = Math.round(
      clamp(desiredLampCct, fixture.cctMin, fixture.cctMax) / 100,
    ) * 100;
    const atLimit = lampCct === fixture.cctMin || lampCct === fixture.cctMax;
    return {
      lampCct,
      effectiveCct: target,
      gel: "无色纸",
      gelLossStops: 0,
      note: atLimit
        ? "已到这款灯的色温边界，混合光可能仍有轻微偏色。"
        : "已按环境光与主光比例做近似混色补偿。",
    };
  }

  const fixedCct = fixture.cctMin;
  const deltaMired = 1_000_000 / desiredLampCct - 1_000_000 / fixedCct;
  const gel = nearestGel(deltaMired);
  const effectiveCct = Math.round(
    1_000_000 / (1_000_000 / fixedCct + gel.shift),
  );
  return {
    lampCct: fixedCct,
    effectiveCct,
    gel: gel.label,
    gelLossStops: gel.loss,
    note:
      gel.label === "无色纸"
        ? "这是一款定色温灯，当前无需校色色纸。"
        : `定色温灯请加 ${gel.label}，并已把色纸损耗计入功率。`,
  };
}

function uncertaintyFor(
  fixture: FixtureProfile,
  curveMode: CurveMode,
  hasCalibration: boolean,
) {
  if (hasCalibration && curveMode === "calibrated") return 0.05;
  if (
    fixture.dataConfidence === "official" &&
    curveMode === "linear" &&
    fixture.linearCurveDocumented
  )
    return 0.07;
  if (fixture.dataConfidence === "official" && curveMode === "linear")
    return 0.12;
  if (fixture.dataConfidence === "official") return 0.18;
  if (fixture.dataConfidence === "catalog") return 0.22;
  return 0.35;
}

export function calculateLighting(input: LightingInput): LightingResult {
  const shutterSpeed = shutterSpeedFromAngle(input.fps, input.shutterAngle);
  const requiredLux = incidentLuxForExposure({
    iso: input.iso,
    aperture: input.aperture,
    shutterSpeed,
    compensationStops:
      input.ndStops +
      input.exposureCompensationStops +
      input.faceCorrectionStops,
  });
  const actualDistance = Math.sqrt(
    input.distance ** 2 + (input.lampHeight - input.subjectHeight) ** 2,
  );
  const requiredKeyLux = Math.max(0, requiredLux - input.ambientLux);
  const preliminaryCct = recommendCct({
    fixture: input.fixture,
    targetCct: input.targetCct,
    ambientCct: input.ambientCct,
    ambientLux: input.ambientLux,
    keyLux: requiredKeyLux,
  });
  const referenceLux =
    input.meterLux ??
    interpolatePhotometrics(input.fixture, preliminaryCct.lampCct);
  // The manual override is explicitly a 1m measurement, regardless of the
  // distance used by the manufacturer's published figure.
  const referenceDistance = input.meterLux ? 1 : input.fixture.referenceM;
  const totalLossStops =
    input.modifierLossStops + preliminaryCct.gelLossStops;
  const fullKeyLux =
    referenceLux *
    Math.max(1, input.lightCount) *
    2 ** -totalLossStops *
    (referenceDistance / Math.max(0.1, actualDistance)) ** 2;
  const requiredFraction =
    fullKeyLux > 0 ? requiredKeyLux / fullKeyLux : Number.POSITIVE_INFINITY;
  const suggestedPower = settingForOutputFraction(
    requiredFraction,
    input.curveMode,
    input.calibration,
  );
  const currentKeyLux =
    fullKeyLux *
    outputFractionAtSetting(
      input.currentPower,
      input.curveMode,
      input.calibration,
    );
  const totalLux = input.ambientLux + currentKeyLux;
  const uncertainty = input.meterLux
    ? input.curveMode === "calibrated" || input.curveMode === "linear"
      ? 0.07
      : 0.15
    : uncertaintyFor(
        input.fixture,
        input.curveMode,
        input.calibration.length > 0,
      );
  const lowFraction = requiredFraction / (1 + uncertainty);
  const highFraction = requiredFraction / Math.max(0.05, 1 - uncertainty);
  const powerRange: [number, number] = [
    clamp(
      settingForOutputFraction(
        lowFraction,
        input.curveMode,
        input.calibration,
      ),
      0,
      100,
    ),
    clamp(
      settingForOutputFraction(
        highFraction,
        input.curveMode,
        input.calibration,
      ),
      0,
      100,
    ),
  ];
  const confidence: LightingResult["confidence"] =
    uncertainty <= 0.08 ? "高" : uncertainty <= 0.23 ? "中" : "低";
  const environmentTargetLux =
    input.ambientLux * 2 ** input.environmentCorrectionStops;
  const environmentFillLux = Math.max(
    0,
    environmentTargetLux - input.ambientLux,
  );
  const environmentSuggestedPower = settingForOutputFraction(
    fullKeyLux > 0 ? environmentFillLux / fullKeyLux : 0,
    input.curveMode,
    input.calibration,
  );
  const status: LightingResult["status"] =
    input.ambientLux >= requiredLux
      ? "ambient-too-bright"
      : requiredFraction > 1
        ? "underpowered"
        : "ready";

  return {
    shutterSpeed,
    requiredLux,
    actualDistance,
    referenceLux,
    fullKeyLux,
    currentKeyLux,
    totalLux,
    requiredKeyLux,
    suggestedPower,
    powerRange,
    subjectDeltaStops: stopDifference(totalLux, requiredLux),
    keyToAmbientStops:
      input.ambientLux > 0
        ? stopDifference(currentKeyLux, input.ambientLux)
        : null,
    environmentTargetLux,
    environmentFillLux,
    environmentSuggestedPower,
    confidence,
    confidenceReason:
      input.meterLux
        ? `当前设备 1m/100% 实测 + ${input.curveMode === "native" ? "默认曲线范围" : "已确认调光曲线"}`
        : input.curveMode === "calibrated" && input.calibration.length
        ? "本机调光校准 + 灯具照度资料"
        : input.curveMode === "linear"
          ? `${input.fixture.dataLabel} + 灯内 Linear 曲线`
          : `${input.fixture.dataLabel} + 原厂默认曲线估算`,
    cct: preliminaryCct,
    status,
  };
}
