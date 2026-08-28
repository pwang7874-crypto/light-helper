"use client";

import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  calculateLighting,
  clamp,
  type CalibrationPoint,
  type CurveMode,
  signedStop,
} from "./lighting-core";
import {
  brands,
  confidenceLabel,
  fixtureProfiles,
  type FixtureProfile,
} from "./lighting-data";
import {
  analyzePhoto,
  comparePhotos,
  type FacePosition,
  type PhotoReading,
  validateImageFile,
} from "./photo-analysis";
import {
  importShots,
  loadShots,
  newShotId,
  removeShot,
  saveShot,
  type CalculatorSnapshot,
  type SavedShot,
} from "./shot-storage";
import {
  deleteCloudShot,
  saveCloudShot,
  syncCloudShots,
} from "./cloud-api";

const DEFAULT_FIXTURE =
  fixtureProfiles.find((fixture) => fixture.model === "VL-120Bi") ??
  fixtureProfiles[0];

const ISO_OPTIONS = [400, 800, 1250, 1600, 3200];
const APERTURE_OPTIONS = [1.4, 2, 2.8, 4, 5.6, 8];
const FPS_OPTIONS = [24, 25, 30, 48, 50, 60];
const SHUTTER_ANGLES = [90, 144, 172.8, 180, 270, 360];
const AMBIENT_PRESETS = [
  ["黑棚/夜内", 10],
  ["昏暗室内", 50],
  ["普通室内", 150],
  ["窗边日光", 600],
  ["阴天外景", 5000],
] as const;
const MODIFIER_PRESETS = [
  ["裸灯/标配反光罩", 0],
  ["轻柔光", 0.5],
  ["普通柔光箱", 1],
  ["双层柔光箱", 1.5],
  ["大面积框布", 2],
] as const;

type PhotoState = {
  file: File | null;
  preview: string | null;
  reading: PhotoReading | null;
  position: FacePosition;
  status: "idle" | "analyzing" | "ready" | "error";
  error: string;
};

const emptyPhoto = (): PhotoState => ({
  file: null,
  preview: null,
  reading: null,
  position: "auto",
  status: "idle",
  error: "",
});

const formatPower = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  if (value > 100) return ">100%";
  if (value > 0 && value < 10) return `${Math.round(value * 10) / 10}%`;
  return `${Math.round(value)}%`;
};

const calibrationKey = (fixtureId: string) =>
  `lighting-helper-calibration-v3-${fixtureId}`;

const readCalibration = (fixtureId: string): CalibrationPoint[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(calibrationKey(fixtureId)) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (point): point is CalibrationPoint =>
        Boolean(point) &&
        typeof point.setting === "number" &&
        typeof point.output === "number",
    );
  } catch {
    return [];
  }
};

export default function Home() {
  const [mode, setMode] = useState<"quick" | "pro">("quick");
  const [brand, setBrand] = useState(DEFAULT_FIXTURE.brand);
  const [fixtureId, setFixtureId] = useState(DEFAULT_FIXTURE.id);
  const [search, setSearch] = useState("");
  const [iso, setIso] = useState(800);
  const [aperture, setAperture] = useState(2.8);
  const [fps, setFps] = useState(24);
  const [shutterAngle, setShutterAngle] = useState(180);
  const [ndStops, setNdStops] = useState(0);
  const [exposureCompensation, setExposureCompensation] = useState(0);
  const [ambientLux, setAmbientLux] = useState(50);
  const [ambientCct, setAmbientCct] = useState(5600);
  const [targetCct, setTargetCct] = useState(5600);
  const [distance, setDistance] = useState(2);
  const [lampHeight, setLampHeight] = useState(2);
  const [lightCount, setLightCount] = useState(1);
  const [modifierLoss, setModifierLoss] = useState(0.5);
  const [currentPower, setCurrentPower] = useState(50);
  const [curveMode, setCurveMode] = useState<CurveMode>(
    DEFAULT_FIXTURE.linearCurveDocumented ? "linear" : "native",
  );
  const [calibration, setCalibration] = useState<CalibrationPoint[]>([]);
  const [meterLux, setMeterLux] = useState<number | null>(null);
  const [previousPhoto, setPreviousPhoto] = useState<PhotoState>(emptyPhoto);
  const [currentPhoto, setCurrentPhoto] = useState<PhotoState>(emptyPhoto);
  const [sameCameraConfirmed, setSameCameraConfirmed] = useState(false);
  const [photoApplied, setPhotoApplied] = useState(false);
  const [notice, setNotice] = useState(
    "先选灯、距离和环境；有上一镜时再上传照片对齐。",
  );
  const [project, setProject] = useState("我的拍摄项目");
  const [scene, setScene] = useState("1");
  const [shot, setShot] = useState("1");
  const [records, setRecords] = useState<SavedShot[]>([]);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const heroFilmA = useRef<HTMLVideoElement>(null);
  const heroFilmB = useRef<HTMLVideoElement>(null);
  const previewUrls = useRef<{ previous: string | null; current: string | null }>({
    previous: null,
    current: null,
  });

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Local builds change frequently. An older cache can pair new HTML with
      // stale client code and leave the calculator visible but non-interactive.
      if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((items) => Promise.all(items.map((item) => item.unregister())))
          .then(() => caches.keys())
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => undefined);
      } else {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
    }
    const urls = previewUrls.current;
    return () => {
      if (urls.previous) URL.revokeObjectURL(urls.previous);
      if (urls.current) URL.revokeObjectURL(urls.current);
    };
  }, []);

  useEffect(() => {
    const local = loadShots();
    setRecords(local);
    void syncCloudShots(local)
      .then((items) => {
        setRecords(items);
        setNotice("镜次记录已与云端同步；照片原图仍只在本机分析。");
      })
      .catch(() => {
        setNotice("云端镜次暂未同步，本机记录仍可正常使用。");
      });
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const films = [heroFilmA.current, heroFilmB.current];
    if (films.some((film) => !film)) return;
    const [firstFilm, secondFilm] = films as [HTMLVideoElement, HTMLVideoElement];
    let active = firstFilm;
    let standby = secondFilm;
    let transitioning = false;
    let transitionTimer: number | undefined;
    const crossfade = () => {
      if (
        transitioning ||
        !Number.isFinite(active.duration) ||
        active.currentTime < active.duration - 1.15
      )
        return;
      transitioning = true;
      standby.currentTime = 0;
      void standby.play().catch(() => undefined);
      standby.classList.add("is-visible");
      transitionTimer = window.setTimeout(() => {
        active.pause();
        active.currentTime = 0;
        active.classList.remove("is-visible");
        const previous = active;
        active = standby;
        standby = previous;
        transitioning = false;
      }, 1080);
    };
    const interval = window.setInterval(crossfade, 160);
    return () => {
      window.clearInterval(interval);
      if (transitionTimer) window.clearTimeout(transitionTimer);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const films = [heroFilmA.current, heroFilmB.current].filter(
      (film): film is HTMLVideoElement => Boolean(film),
    );
    const drift = () => {
      films.forEach((film) => {
        film.style.objectPosition = `${44 + Math.random() * 12}% ${45 + Math.random() * 10}%`;
        film.style.transform = `scale(${1.035 + Math.random() * 0.035})`;
      });
    };
    drift();
    const timer = window.setInterval(drift, 6800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const moveLight = (x: number, y: number) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty(
          "--light-x",
          `${(x / window.innerWidth) * 100}%`,
        );
        document.documentElement.style.setProperty(
          "--light-y",
          `${(y / window.innerHeight) * 100}%`,
        );
      });
    };
    const followPointer = (event: PointerEvent) =>
      moveLight(event.clientX, event.clientY);
    const followTouch = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (touch) moveLight(touch.clientX, touch.clientY);
    };
    window.addEventListener("pointermove", followPointer, { passive: true });
    window.addEventListener("touchstart", followTouch, { passive: true });
    window.addEventListener("touchmove", followTouch, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", followPointer);
      window.removeEventListener("touchstart", followTouch);
      window.removeEventListener("touchmove", followTouch);
    };
  }, []);

  useEffect(() => {
    if (!recordsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRecordsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [recordsOpen]);

  const fixture =
    fixtureProfiles.find((item) => item.id === fixtureId) ?? DEFAULT_FIXTURE;

  const visibleFixtures = useMemo(() => {
    const query = search.trim().toLowerCase();
    return fixtureProfiles.filter((item) => {
      if (!query) return item.brand === brand;
      return `${item.brand} ${item.model} ${item.form}`
        .toLowerCase()
        .includes(query);
    });
  }, [brand, search]);

  const photoMatch = useMemo(() => {
    if (!previousPhoto.reading || !currentPhoto.reading) return null;
    return comparePhotos(previousPhoto.reading, currentPhoto.reading);
  }, [previousPhoto.reading, currentPhoto.reading]);

  const appliedPhoto =
    photoApplied && sameCameraConfirmed && photoMatch ? photoMatch : null;
  const calculation = useMemo(
    () =>
      calculateLighting({
        fixture,
        iso,
        aperture,
        fps,
        shutterAngle,
        ndStops,
        exposureCompensationStops: exposureCompensation,
        faceCorrectionStops: appliedPhoto?.faceCorrectionStops ?? 0,
        environmentCorrectionStops:
          appliedPhoto?.environmentCorrectionStops ?? 0,
        ambientLux,
        ambientCct: appliedPhoto?.currentCct ?? ambientCct,
        targetCct: appliedPhoto?.targetCct ?? targetCct,
        distance,
        lampHeight,
        subjectHeight: 1.63,
        lightCount,
        modifierLossStops: modifierLoss,
        currentPower,
        curveMode,
        calibration,
        meterLux,
      }),
    [
      ambientCct,
      ambientLux,
      aperture,
      appliedPhoto,
      calibration,
      currentPower,
      curveMode,
      distance,
      exposureCompensation,
      fixture,
      fps,
      iso,
      lampHeight,
      lightCount,
      meterLux,
      modifierLoss,
      ndStops,
      shutterAngle,
      targetCct,
    ],
  );

  const selectFixture = (next: FixtureProfile) => {
    setFixtureId(next.id);
    setBrand(next.brand);
    setCurveMode(next.linearCurveDocumented ? "linear" : "native");
    setCalibration(readCalibration(next.id));
    setMeterLux(null);
    setNotice(
      next.dataConfidence === "official"
        ? "已使用厂商官方照度资料。"
        : "这款灯缺少完整官方光度数据，结果会同时显示估算范围。",
    );
  };

  const selectBrand = (nextBrand: string) => {
    setBrand(nextBrand);
    setSearch("");
    const first = fixtureProfiles.find((item) => item.brand === nextBrand);
    if (first) selectFixture(first);
  };

  const updatePhoto = async (
    kind: "previous" | "current",
    file: File,
    position: FacePosition,
    createPreview: boolean,
  ) => {
    const validationError = validateImageFile(file);
    const setter = kind === "previous" ? setPreviousPhoto : setCurrentPhoto;
    if (validationError) {
      setter((value) => ({ ...value, status: "error", error: validationError }));
      return;
    }
    let preview =
      kind === "previous" ? previousPhoto.preview : currentPhoto.preview;
    if (createPreview) {
      const oldUrl = previewUrls.current[kind];
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      preview = URL.createObjectURL(file);
      previewUrls.current[kind] = preview;
    }
    setter((value) => ({
      ...value,
      file,
      preview,
      position,
      status: "analyzing",
      error: "",
    }));
    try {
      const reading = await analyzePhoto(file, position);
      setter((value) => ({ ...value, reading, position, status: "ready" }));
      setPhotoApplied(false);
      setNotice("照片已在本机完成分析。确认拍摄条件后再应用连续性修正。");
    } catch (error) {
      setter((value) => ({
        ...value,
        status: "error",
        error: error instanceof Error ? error.message : "照片分析失败。",
      }));
    }
  };

  const handlePhotoFile = (
    kind: "previous" | "current",
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void updatePhoto(kind, file, "auto", true);
  };

  const changeFacePosition = (
    kind: "previous" | "current",
    position: FacePosition,
  ) => {
    const state = kind === "previous" ? previousPhoto : currentPhoto;
    const setter = kind === "previous" ? setPreviousPhoto : setCurrentPhoto;
    setter((value) => ({ ...value, position }));
    if (state.file) void updatePhoto(kind, state.file, position, false);
  };

  const removePhotoState = (kind: "previous" | "current") => {
    const url = previewUrls.current[kind];
    if (url) URL.revokeObjectURL(url);
    previewUrls.current[kind] = null;
    if (kind === "previous") setPreviousPhoto(emptyPhoto());
    else setCurrentPhoto(emptyPhoto());
    setPhotoApplied(false);
    setSameCameraConfirmed(false);
  };

  const applyPhotoMatch = () => {
    if (!photoMatch || !sameCameraConfirmed) return;
    setPhotoApplied(true);
    setNotice(
      `已应用：人物 ${signedStop(photoMatch.faceCorrectionStops)}，环境 ${signedStop(photoMatch.environmentCorrectionStops)}。`,
    );
  };

  const calibrationValue = (setting: number) =>
    calibration.find((point) => point.setting === setting)?.output ?? "";

  const setCalibrationValue = (setting: number, raw: string) => {
    const output = Number(raw);
    setCalibration((current) => {
      const without = current.filter((point) => point.setting !== setting);
      if (!raw || !Number.isFinite(output)) return without;
      return [...without, { setting, output: clamp(output, 0.1, 99.9) }].sort(
        (a, b) => a.setting - b.setting,
      );
    });
  };

  const persistCalibration = () => {
    try {
      window.localStorage.setItem(
        calibrationKey(fixture.id),
        JSON.stringify(calibration),
      );
      setCurveMode(calibration.length ? "calibrated" : "native");
      setNotice(
        calibration.length
          ? "已把本机调光校准保存到当前设备。"
          : "没有可保存的校准点。",
      );
    } catch {
      setNotice("浏览器未允许本机存储，校准暂时无法保存。");
    }
  };

  const snapshot = (): CalculatorSnapshot => ({
    fixtureId: fixture.id,
    iso,
    aperture,
    fps,
    shutterAngle,
    ndStops,
    exposureCompensationStops: exposureCompensation,
    ambientLux,
    ambientCct,
    targetCct,
    distance,
    lampHeight,
    lightCount,
    modifierLossStops: modifierLoss,
    currentPower,
    curveMode,
    meterLux,
    photoApplied,
    previousReading: previousPhoto.reading,
    currentReading: currentPhoto.reading,
  });

  const saveCurrentShot = () => {
    const now = new Date().toISOString();
    const record: SavedShot = {
      id: newShotId(),
      version: 3,
      project: project.trim() || "未命名项目",
      scene: scene.trim() || "—",
      shot: shot.trim() || "—",
      createdAt: now,
      updatedAt: now,
      snapshot: snapshot(),
      result: {
        fixture: `${fixture.brand} · ${fixture.model}`,
        power: calculation.suggestedPower,
        powerLow: calculation.powerRange[0],
        powerHigh: calculation.powerRange[1],
        cct: calculation.cct.lampCct,
        gel: calculation.cct.gel,
        confidence: calculation.confidence,
      },
    };
    try {
      setRecords(saveShot(record));
      setNotice(`已保存：${record.project} · ${record.scene}场 · ${record.shot}镜，正在同步云端。`);
      void saveCloudShot(record)
        .then(() => {
          setNotice(`已保存并同步：${record.project} · ${record.scene}场 · ${record.shot}镜。`);
        })
        .catch(() => {
          setNotice("已保存在本机，但云端同步失败；稍后会再次同步。");
        });
    } catch {
      setNotice("浏览器未允许本机存储，镜次记录没有保存。");
    }
  };

  const resetCalculator = () => {
    selectFixture(DEFAULT_FIXTURE);
    setMode("quick");
    setIso(800);
    setAperture(2.8);
    setFps(24);
    setShutterAngle(180);
    setNdStops(0);
    setExposureCompensation(0);
    setAmbientLux(50);
    setAmbientCct(5600);
    setTargetCct(5600);
    setDistance(2);
    setLampHeight(2);
    setLightCount(1);
    setModifierLoss(0.5);
    setCurrentPower(50);
    setMeterLux(null);
    setPhotoApplied(false);
    setNotice("已恢复常用片场参数；修改任一输入，结果会立即更新。");
  };

  const loadRecord = (record: SavedShot) => {
    const data = record.snapshot;
    const savedFixture = fixtureProfiles.find(
      (item) => item.id === data.fixtureId,
    );
    if (savedFixture) selectFixture(savedFixture);
    setProject(record.project);
    setScene(record.scene);
    setShot(record.shot);
    setIso(data.iso);
    setAperture(data.aperture);
    setFps(data.fps);
    setShutterAngle(data.shutterAngle);
    setNdStops(data.ndStops);
    setExposureCompensation(data.exposureCompensationStops);
    setAmbientLux(data.ambientLux);
    setAmbientCct(data.ambientCct);
    setTargetCct(data.targetCct);
    setDistance(data.distance);
    setLampHeight(data.lampHeight);
    setLightCount(data.lightCount);
    setModifierLoss(data.modifierLossStops);
    setCurrentPower(data.currentPower);
    setCurveMode(data.curveMode);
    setMeterLux(data.meterLux);
    setPreviousPhoto({
      ...emptyPhoto(),
      reading: data.previousReading,
      status: data.previousReading ? "ready" : "idle",
    });
    setCurrentPhoto({
      ...emptyPhoto(),
      reading: data.currentReading,
      status: data.currentReading ? "ready" : "idle",
    });
    setSameCameraConfirmed(Boolean(data.previousReading && data.currentReading));
    setPhotoApplied(data.photoApplied);
    setRecordsOpen(false);
    setNotice("已载入镜次记录；照片原图不保存，只恢复本机分析结果。");
  };

  const exportRecords = () => {
    const data = loadShots();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `别穿帮-镜次记录-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importRecords = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice("导入文件不能超过 2MB。");
      return;
    }
    try {
      const imported = importShots(await file.text());
      setRecords(imported);
      setNotice("镜次记录导入成功，正在同步云端。");
      void syncCloudShots(imported)
        .then(setRecords)
        .catch(() => setNotice("导入已保存在本机，云端同步稍后重试。"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败。");
    }
  };

  const environmentInstruction = (() => {
    if (!appliedPhoto) return "未应用照片环境对照；使用现场环境照度输入。";
    if (calculation.environmentFillLux > 5)
      return `环境补光目标 ${Math.round(calculation.environmentTargetLux)} lx，需增加约 ${Math.round(calculation.environmentFillLux)} lx；若同款灯也在当前距离照环境，从 ${formatPower(calculation.environmentSuggestedPower)} 起调。`;
    if (appliedPhoto.environmentCorrectionStops < -0.15)
      return `现场环境比上一镜亮 ${Math.abs(appliedPhoto.environmentCorrectionStops).toFixed(1)} 档：优先控窗、减环境灯或调整机位。`;
    return "现场环境与上一镜接近，无需额外补环境光。";
  })();

  const outputPower =
    calculation.status === "ambient-too-bright"
      ? "0%"
      : formatPower(calculation.suggestedPower);

  return (
    <main className="app">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="回到页面顶部">
          别穿帮 <span>灯光助手</span>
        </a>
        <div className="top-actions">
          <span className="offline-badge">照片本机分析 · 镜次云端同步</span>
          <button
            type="button"
            className="quiet-button"
            onClick={() => {
              const local = loadShots();
              setRecords(local);
              setRecordsOpen(true);
              void syncCloudShots(local).then(setRecords).catch(() => undefined);
            }}
          >
            镜次记录
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <video
          ref={heroFilmA}
          className="hero-film is-visible"
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/hero-film-still.png"
        >
          <source src="/hero-japan-train-clean.mp4" type="video/mp4" />
        </video>
        <video
          ref={heroFilmB}
          className="hero-film hero-film-next"
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src="/hero-japan-train-clean.mp4" type="video/mp4" />
        </video>
        <div className="hero-copy">
          <span className="eyebrow">ON-SET LIGHT CONTINUITY · V3</span>
          <h1><span>让每一盏灯的数字，</span><span>都接上上一镜的光。</span></h1>
          <p>
            对照上一镜和现在现场，直接得到灯具功率、色温与环境补光目标。
          </p>
          <div className="intro-stats" aria-label="灯具数据库统计">
            <div><strong>{fixtureProfiles.length}</strong><span>款灯具</span></div>
            <div><strong>{brands.length}</strong><span>个品牌</span></div>
          </div>
        </div>
        <a className="hero-scroll" href="#calculator">开始计算 <span>↓</span></a>
      </section>

      <section className="calc-shell" id="calculator">
      <div className="steps" aria-label="计算流程">
        <span className="active"><b>01</b>上一镜与现场</span><i />
        <span className="active"><b>02</b>品牌与型号</span><i />
        <span><b>03</b>现场最终指令</span>
      </div>

      <nav className="mode-switch" aria-label="使用模式">
        <button
          type="button"
          className={mode === "quick" ? "active" : ""}
          aria-pressed={mode === "quick"}
          onClick={() => setMode("quick")}
        >
          快速模式
          <small>学生与现场快速调灯</small>
        </button>
        <button
          type="button"
          className={mode === "pro" ? "active" : ""}
          aria-pressed={mode === "pro"}
          onClick={() => setMode("pro")}
        >
          专业模式
          <small>完整曝光与校准参数</small>
        </button>
      </nav>

      <div className="live-calculation-bar" role="status">
        <span className="live-dot" aria-hidden="true" />
        <b>即时计算已开启</b>
        <p>修改灯具、距离、环境或曝光后，右侧功率与色温会立即更新。</p>
        <button type="button" onClick={resetCalculator}>恢复常用参数</button>
      </div>

      <div className="workspace">
        <div className="workflow">
          <Panel
            step="01"
            title="上一镜和现在现场"
            hint="照片只在当前设备分析，不会上传到服务器"
          >
            <div className="photo-grid">
              <PhotoUploader
                id="previous-photo"
                title="上一镜"
                state={previousPhoto}
                onFile={(event) => handlePhotoFile("previous", event)}
                onPosition={(value) => changeFacePosition("previous", value)}
                onRemove={() => removePhotoState("previous")}
              />
              <PhotoUploader
                id="current-photo"
                title="现在现场"
                state={currentPhoto}
                onFile={(event) => handlePhotoFile("current", event)}
                onPosition={(value) => changeFacePosition("current", value)}
                onRemove={() => removePhotoState("current")}
              />
            </div>
            {photoMatch && (
              <div className="photo-match" aria-live="polite">
                <div>
                  <small>人物亮度修正</small>
                  <strong>{signedStop(photoMatch.faceCorrectionStops)}</strong>
                </div>
                <div>
                  <small>环境亮度修正</small>
                  <strong>{signedStop(photoMatch.environmentCorrectionStops)}</strong>
                </div>
                <div>
                  <small>图像色温变化</small>
                  <strong>
                    {photoMatch.kelvinShift >= 0 ? "+" : ""}
                    {photoMatch.kelvinShift}K
                  </strong>
                </div>
                <label className="confirm-row">
                  <input
                    type="checkbox"
                    checked={sameCameraConfirmed}
                    onChange={(event) => {
                      setSameCameraConfirmed(event.target.checked);
                      if (!event.target.checked) setPhotoApplied(false);
                    }}
                  />
                  两张照片使用同一相机曝光，并锁定了白平衡
                </label>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!sameCameraConfirmed}
                  onClick={applyPhotoMatch}
                >
                  {photoApplied ? "已应用照片连续性" : "应用到灯光计算"}
                </button>
                <p>
                  图像色温只用于连续性起点；相机自动白平衡开启时不会作为精确色温表使用。
                </p>
              </div>
            )}
          </Panel>

          <Panel
            step="02"
            title="选择你手上的灯"
            hint="官方资料优先；没有完整资料的型号会显示估算范围"
          >
            <label className="search-field">
              <span>搜索品牌或型号</span>
              <input
                type="search"
                value={search}
                placeholder="例如：智云 X100、优篮子、神牛"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="brand-list" aria-label="灯具品牌">
              {brands.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={!search && brand === item ? "active" : ""}
                  aria-pressed={!search && brand === item}
                  onClick={() => selectBrand(item)}
                >
                  {item}
                  <small>
                    {fixtureProfiles.filter((entry) => entry.brand === item).length}
                  </small>
                </button>
              ))}
            </div>
            <div className="model-grid">
              {visibleFixtures.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={fixture.id === item.id ? "model active" : "model"}
                  aria-pressed={fixture.id === item.id}
                  onClick={() => selectFixture(item)}
                >
                  <span className={`data-dot ${item.dataConfidence}`} />
                  <strong>{item.model}</strong>
                  <span>{item.form} · {item.kind}</span>
                  <small>{item.dataLabel} · {item.luxNote}</small>
                </button>
              ))}
              {!visibleFixtures.length && (
                <p className="empty-state">没有找到这个型号，可以换品牌名或简写搜索。</p>
              )}
            </div>
            <div className="fixture-card">
              <div>
                <span className={`confidence ${fixture.dataConfidence}`}>
                  数据可信度 {confidenceLabel[fixture.dataConfidence]}
                </span>
                <h3>{fixture.brand} · {fixture.model}</h3>
                <p>
                  {fixture.watts}W · {fixture.cct}K · CRI {fixture.cri} · TLCI {fixture.tlci}
                </p>
              </div>
              <div className="fixture-source">
                <b>{fixture.referenceLux.toLocaleString()} lx</b>
                <span>
                  @ {fixture.referenceM}m · {fixture.testedModifier}
                  {fixture.testedCct ? ` · ${fixture.testedCct}K` : ""}
                </span>
                {fixture.sourceUrl ? (
                  <a href={fixture.sourceUrl} target="_blank" rel="noreferrer">
                    查看厂商来源
                  </a>
                ) : (
                  <em>项目灯具数据库，等待补充官方来源</em>
                )}
              </div>
            </div>
            {fixture.brand === "自定义灯具" && (
              <div className="custom-fixture-input">
                <NumberField
                  label="这盏灯在1m、100%时的照度"
                  value={meterLux ?? 0}
                  setValue={(value) => setMeterLux(value > 0 ? value : null)}
                  min={0}
                  max={1000000}
                  suffix="lx"
                />
                <p>没有测光表时可先用系统低可信估算；有厂商1m照度也可以直接填入。</p>
              </div>
            )}
          </Panel>

          <Panel
            step="03"
            title="现场距离与环境"
            hint="日常档位优先；不需要先理解光度学公式"
          >
            <div className="quick-controls">
              <RangeField label="灯到人物水平距离" value={distance} setValue={setDistance} min={0.5} max={12} step={0.1} suffix="m" />
              <RangeField label="灯架高度" value={lampHeight} setValue={setLampHeight} min={1} max={6} step={0.1} suffix="m" />
              <RangeField label="灯现在的档位" value={currentPower} setValue={setCurrentPower} min={0} max={100} step={1} suffix="%" />
              <SelectField
                label="柔光附件"
                value={String(modifierLoss)}
                onChange={(value) => setModifierLoss(Number(value))}
                options={MODIFIER_PRESETS.map(([label, value]) => ({ label: `${label}（约损失 ${value} 档）`, value: String(value) }))}
              />
              <SelectField
                label="相同灯具数量"
                value={String(lightCount)}
                onChange={(value) => setLightCount(Number(value))}
                options={[1, 2, 3, 4].map((value) => ({ label: `${value} 盏`, value: String(value) }))}
              />
            </div>
            <div className="preset-row" aria-label="环境照度预设">
              {AMBIENT_PRESETS.map(([label, value]) => (
                <button type="button" key={label} className={ambientLux === value ? "active" : ""} onClick={() => setAmbientLux(value)}>{label}</button>
              ))}
            </div>
            <div className="quick-controls compact">
              <NumberField label="现在环境照度" value={ambientLux} setValue={setAmbientLux} min={0} max={100000} suffix="lx" />
              <NumberField label="现在环境色温" value={ambientCct} setValue={setAmbientCct} min={2000} max={12000} step={100} suffix="K" />
              <NumberField label="要接回的目标色温" value={targetCct} setValue={setTargetCct} min={2000} max={12000} step={100} suffix="K" />
            </div>
          </Panel>

          <Panel step="04" title="相机曝光" hint={mode === "quick" ? "快速模式使用常见电影机默认值" : "专业模式可逐项校准"}>
            {mode === "quick" ? (
              <div className="camera-summary">
                <span>ISO {iso}</span><span>T{aperture}</span><span>{fps}fps</span><span>{shutterAngle}°快门</span>
                <button type="button" onClick={() => setMode("pro")}>修改专业参数</button>
              </div>
            ) : (
              <div className="pro-controls">
                <ChipField label="ISO" value={iso} setValue={setIso} options={ISO_OPTIONS} />
                <ChipField label="光圈 / T值" value={aperture} setValue={setAperture} options={APERTURE_OPTIONS} format={(value) => `T${value}`} />
                <ChipField label="帧率" value={fps} setValue={setFps} options={FPS_OPTIONS} format={(value) => `${value}fps`} />
                <ChipField label="快门角度" value={shutterAngle} setValue={setShutterAngle} options={SHUTTER_ANGLES} format={(value) => `${value}°`} />
                <NumberField label="ND减光" value={ndStops} setValue={setNdStops} min={0} max={10} step={0.1} suffix="档" />
                <NumberField label="创意曝光偏移" value={exposureCompensation} setValue={setExposureCompensation} min={-4} max={4} step={0.1} suffix="档" />
                <NumberField label="当前灯具功率" value={currentPower} setValue={setCurrentPower} min={0} max={100} step={1} suffix="%" />
                <NumberField label="1m实测校准（可选）" value={meterLux ?? 0} setValue={(value) => setMeterLux(value > 0 ? value : null)} min={0} max={1000000} suffix="lx" />
              </div>
            )}
            <div className="curve-panel">
              <div><b>灯具调光曲线</b><p>不同型号的1%—100%并不完全相同。最稳妥的方法是把支持的灯设为 Linear，或录入本机校准点。</p></div>
              <SelectField
                label="当前曲线"
                value={curveMode}
                onChange={(value) => setCurveMode(value as CurveMode)}
                options={[
                  { label: fixture.linearCurveDocumented ? "灯内 Linear（厂商文档支持，推荐）" : "灯内 Linear（请先确认灯具菜单）", value: "linear" },
                  { label: "原厂默认/未知（显示范围）", value: "native" },
                  { label: "本机实测校准", value: "calibrated" },
                ]}
              />
              <details className="calibration-panel">
                <summary>录入可选的本机调光校准</summary>
                <p>填写该档位实测亮度占100%亮度的比例；没有测光条件可以不填。</p>
                <div className="calibration-grid">
                  {[25, 50, 75].map((setting) => (
                    <label key={setting}>
                      <span>{setting}%档位实测输出</span>
                      <input type="number" min="0.1" max="99.9" step="0.1" placeholder={`${setting}`} value={calibrationValue(setting)} onChange={(event) => setCalibrationValue(setting, event.target.value)} />
                      <em>%</em>
                    </label>
                  ))}
                </div>
                <button type="button" className="secondary-button" onClick={persistCalibration}>保存当前灯具校准</button>
              </details>
            </div>
          </Panel>

          <Panel step="05" title="保存镜次" hint="按邀请码隔离并同步云端，仍可导出备份">
            <div className="shot-fields">
              <label><span>项目</span><input value={project} onChange={(event) => setProject(event.target.value)} /></label>
              <label><span>场次</span><input value={scene} onChange={(event) => setScene(event.target.value)} /></label>
              <label><span>镜号</span><input value={shot} onChange={(event) => setShot(event.target.value)} /></label>
              <button type="button" className="primary-button" onClick={saveCurrentShot}>保存当前灯光设置</button>
            </div>
          </Panel>
        </div>

        <aside className="result-panel" aria-live="polite">
          <div className="result-head"><span>现场最终指令</span><b className={`confidence ${fixture.dataConfidence}`}>可信度 {calculation.confidence}</b></div>
          <h2>{fixture.brand}</h2>
          <h3>{fixture.model}</h3>
          <div className="primary-readouts">
            <div><small>灯具功率</small><strong className="readout-value" key={`power-${outputPower}`}>{outputPower}</strong>{calculation.status === "ready" && <span>建议范围 {formatPower(calculation.powerRange[0])}—{formatPower(calculation.powerRange[1])}</span>}</div>
            <div><small>灯具色温</small><strong className="readout-value" key={`cct-${calculation.cct.lampCct}`}>{calculation.cct.lampCct}K</strong><span>{calculation.cct.gel === "无色纸" ? "无需校色色纸" : `加 ${calculation.cct.gel}`}</span></div>
          </div>
          <div className={`status-card ${calculation.status}`}>
            {calculation.status === "underpowered" && <><b>当前灯具功率不足</b><p>靠近人物、减柔光、加灯，或选择更高输出的型号。</p></>}
            {calculation.status === "ambient-too-bright" && <><b>环境光已经超过人物曝光目标</b><p>主光应关闭；优先控窗、加ND、收光圈或降低环境灯。</p></>}
            {calculation.status === "ready" && <><b>可以执行</b><p>先按上方档位设置，再在人物脸前用入射式测光表复核。</p></>}
          </div>
          <dl className="result-details">
            <div><dt>人物目标照度</dt><dd>{Math.round(calculation.requiredLux)} lx</dd></div>
            <div><dt>主光需要贡献</dt><dd>{Math.round(calculation.requiredKeyLux)} lx</dd></div>
            <div><dt>实际斜距</dt><dd>{calculation.actualDistance.toFixed(2)} m</dd></div>
            <div><dt>快门速度</dt><dd>1/{Math.round(calculation.shutterSpeed)}s</dd></div>
            <div><dt>当前人物偏差</dt><dd>{signedStop(calculation.subjectDeltaStops)}</dd></div>
            <div><dt>主光/环境</dt><dd>{calculation.keyToAmbientStops === null ? "无环境光" : signedStop(calculation.keyToAmbientStops)}</dd></div>
          </dl>
          <div className="environment-callout"><small>环境光连续性</small><p>{environmentInstruction}</p></div>
          <div className="result-note"><p>{calculation.cct.note}</p><p>{calculation.confidenceReason}</p><p>{notice}</p></div>
          <details className="method-note"><summary>计算口径与边界</summary><p>人物目标照度使用入射测光公式和标准球形测光头常数 C=340；距离按灯高和水平距离计算斜距。官方照度、测试色温和附件会一起参与计算。没有完整调光曲线时仍给出明确起始档位，同时显示可执行范围，避免伪精确。</p></details>
        </aside>
      </div>
      </section>

      <footer>别穿帮灯光助手 V3 · 照片本机分析 · 镜次云端隔离 · 片场最终仍以测光表复核</footer>

      {recordsOpen && (
        <div className="dialog-layer">
          <section className="records-dialog" role="dialog" aria-modal="true" aria-labelledby="records-title">
            <div className="dialog-head"><div><span>LOCAL SHOT LOG</span><h2 id="records-title">镜次记录</h2></div><button type="button" aria-label="关闭镜次记录" onClick={() => setRecordsOpen(false)}>×</button></div>
            <div className="record-actions"><button type="button" className="secondary-button" onClick={exportRecords}>导出 JSON 备份</button><label className="secondary-button file-button">导入 JSON<input type="file" accept="application/json,.json" onChange={importRecords} /></label></div>
            <div className="record-list">
              {records.map((record) => (
                <article key={record.id}>
                  <div><small>{new Date(record.updatedAt).toLocaleString("zh-CN")}</small><h3>{record.project} · {record.scene}场 · {record.shot}镜</h3><p>{record.result.fixture}</p><b>{formatPower(record.result.power)} · {record.result.cct}K · 可信度{record.result.confidence}</b></div>
                  <div><button type="button" onClick={() => loadRecord(record)}>载入</button><button type="button" className="danger" onClick={() => { if (window.confirm("确定删除这条镜次记录吗？")) { setRecords(removeShot(record.id)); void deleteCloudShot(record.id).catch(() => setNotice("本机记录已删除，云端删除暂时失败。")); } }}>删除</button></div>
                </article>
              ))}
              {!records.length && <p className="empty-state">还没有保存的镜次记录。</p>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Panel({ step, title, hint, children }: { step: string; title: string; hint: string; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-title"><span>{step}</span><div><h2>{title}</h2><p>{hint}</p></div></div>{children}</section>;
}

function PhotoUploader({ id, title, state, onFile, onPosition, onRemove }: { id: string; title: string; state: PhotoState; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onPosition: (position: FacePosition) => void; onRemove: () => void }) {
  return (
    <article className={`photo-card ${state.status}`}>
      <div className="photo-preview">
        {state.preview ? (
          // User-selected local blob URLs are intentionally rendered without remote optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.preview} alt={`${title}预览`} />
        ) : <div><span>＋</span><b>{state.reading ? "已载入分析数据" : `上传${title}`}</b><small>JPG / PNG / WebP / HEIC · 最大16MB</small></div>}
        {state.status === "analyzing" && <div className="photo-loading">正在分析人物与环境…</div>}
        <label className="photo-file-label" htmlFor={id}>{state.preview || state.reading ? "更换照片" : "选择照片"}</label>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={onFile} />
      </div>
      <div className="photo-meta">
        <div className="photo-meta-head"><h3>{title}</h3>{(state.preview || state.reading) && <button type="button" onClick={onRemove}>移除</button>}</div>
        {state.reading && <><dl><div><dt>人物</dt><dd>{state.reading.faceLevel}/100</dd></div><div><dt>环境</dt><dd>{state.reading.environmentLevel}/100</dd></div><div><dt>图像色温</dt><dd>{state.reading.imageKelvin}K</dd></div></dl><label className="position-select"><span>人物位置确认</span><select value={state.position} onChange={(event) => onPosition(event.target.value as FacePosition)}><option value="auto">自动识别</option><option value="left">画面左侧</option><option value="center">画面中央</option><option value="right">画面右侧</option></select></label><p>{state.reading.warning}</p></>}
        {state.status === "error" && <p className="error-message">{state.error}</p>}
      </div>
    </article>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
}

function NumberField({ label, value, setValue, min, max, step = 1, suffix }: { label: string; value: number; setValue: (value: number) => void; min: number; max: number; step?: number; suffix: string }) {
  const commit = (input: HTMLInputElement) => {
    const parsed = Number(input.value);
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
    input.value = String(next);
    setValue(next);
  };
  return <label className="field number-field"><span>{label}</span><div><input key={value} type="number" inputMode="decimal" defaultValue={value} min={min} max={max} step={step} onChange={(event) => { const raw = event.target.value; const parsed = Number(raw); if (raw !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max) setValue(parsed); }} onBlur={(event) => commit(event.currentTarget)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><em>{suffix}</em></div></label>;
}

function RangeField({ label, value, setValue, min, max, step, suffix }: { label: string; value: number; setValue: (value: number) => void; min: number; max: number; step: number; suffix: string }) {
  return <label className="range-field"><span>{label}</span><output>{value}{suffix}</output><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>;
}

function ChipField({ label, value, setValue, options, format = String }: { label: string; value: number; setValue: Dispatch<SetStateAction<number>> | ((value: number) => void); options: number[]; format?: (value: number) => string }) {
  return <fieldset className="chip-field"><legend>{label}</legend><div>{options.map((option) => <button type="button" key={option} className={value === option ? "active" : ""} aria-pressed={value === option} onClick={() => setValue(option)}>{format(option)}</button>)}</div></fieldset>;
}
