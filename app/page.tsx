"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { fixtures } from "./fixtures";

const ambientPresets = [
  ["黑棚 / 夜内", 10],
  ["昏暗室内", 75],
  ["普通室内", 250],
  ["窗边日光", 750],
  ["阴天外景", 5000],
  ["晴天外景", 25000],
] as const;
const subjectPresets = [
  ["18% 灰卡", 0.18],
  ["中等肤色", 0.23],
  ["浅肤色", 0.36],
  ["深肤色", 0.11],
  ["白色背景", 0.85],
  ["黑色织物", 0.04],
] as const;
const diffusionPresets = [
  ["无柔光", 0],
  ["轻柔光", 0.5],
  ["Lee 216 白柔光", 1],
  ["网格布 / 重柔光", 2],
] as const;
const gelPresets = [
  ["无色纸", 0],
  ["1/2 CTO", 0.5],
  ["Full CTO", 1],
  ["深色效果纸", 1.5],
] as const;
const cameras = [
  { id: "arri", label: "ARRI ALEXA 35 · LogC4", baseIso: 800, lookOffset: 0 },
  { id: "sony", label: "Sony VENICE 2 · S-Log3", baseIso: 800, lookOffset: 0.3 },
  { id: "red", label: "RED V-RAPTOR · Log3G10", baseIso: 800, lookOffset: 0.2 },
  { id: "canon", label: "Canon C500 Mark II · C-Log2", baseIso: 800, lookOffset: 0.3 },
  { id: "bmd", label: "Blackmagic PYXIS · Film Gen 5", baseIso: 800, lookOffset: -0.2 },
  { id: "custom", label: "自定义机型 / LUT", baseIso: 800, lookOffset: 0 },
] as const;
const stop = (value: number, target: number) =>
  Math.log2(Math.max(value, 0.01) / Math.max(target, 0.01));
const signedStop = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(1)} 档`;
const numericWatts = (watts: string) => Number((watts.match(/[0-9]+/) ?? ["0"])[0]);
const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)] ?? 0;
};
type PhotoReading = { face: number; environment: number; kelvin: number };

export default function Home() {
  const brands = useMemo(
    () => [...new Set(fixtures.map((item) => item.brand))],
    [],
  );
  const [brand, setBrand] = useState(brands[0]);
  const models = useMemo(
    () => fixtures.filter((item) => item.brand === brand),
    [brand],
  );
  const [model, setModel] = useState(models[0]?.model ?? "");
  const [cameraId, setCameraId] = useState("arri");
  const [iso, setIso] = useState(800);
  const [aperture, setAperture] = useState(2.8);
  const [fps, setFps] = useState(24);
  const [shutterSpeed, setShutterSpeed] = useState(48);
  const [nd, setNd] = useState(0);
  const [offset, setOffset] = useState(0);
  const [subject, setSubject] = useState(0.23);
  const [ambient, setAmbient] = useState(250);
  const [distance, setDistance] = useState(2);
  const [height, setHeight] = useState(1.9);
  const [power, setPower] = useState(50);
  const [count, setCount] = useState(1);
  const [diffusion, setDiffusion] = useState(1);
  const [gel, setGel] = useState(0);
  const [meterLux, setMeterLux] = useState<number | null>(null);
  const [previousImage, setPreviousImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [previousReading, setPreviousReading] = useState<PhotoReading | null>(null);
  const [currentReading, setCurrentReading] = useState<PhotoReading | null>(null);
  const [continuityStop, setContinuityStop] = useState(0);
  const [note, setNote] = useState(
    "选择品牌与型号后，数据会按厂商标注的照度规格实时计算。",
  );
  const fixture =
    fixtures.find((item) => item.brand === brand && item.model === model) ??
    models[0];
  const camera = cameras.find((item) => item.id === cameraId) ?? cameras[0];
  const photoDelta = previousReading && currentReading ? stop(previousReading.face, currentReading.face) : null;

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>, kind: "previous" | "current") => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const [reading, url] = await Promise.all([analyzePhoto(file), Promise.resolve(URL.createObjectURL(file))]);
      if (kind === "previous") { setPreviousImage(url); setPreviousReading(reading); }
      else { setCurrentImage(url); setCurrentReading(reading); }
      setNote("照片只在当前设备浏览器内分析；脸部区域与画面周边分别用于亮度对照。");
    } catch { setNote("这张照片无法读取，请换一张正常曝光、主体清楚的图片。"); }
  };

  useEffect(() => setModel(models[0]?.model ?? ""), [brand, models]);
  useEffect(() => setMeterLux(null), [model]);
  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>(".hero-film");
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const drift = () => {
      video.style.objectPosition = `${44 + Math.random() * 12}% ${45 + Math.random() * 10}%`;
      video.style.transform = `scale(${1.035 + Math.random() * 0.035})`;
    };
    drift();
    const timer = window.setInterval(drift, 6800);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const followPointer = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--light-x", `${(event.clientX / window.innerWidth) * 100}%`);
        document.documentElement.style.setProperty("--light-y", `${(event.clientY / window.innerHeight) * 100}%`);
      });
    };
    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", followPointer);
    };
  }, []);

  const calc = useMemo(() => {
    const exposureTime = 1 / shutterSpeed;
    const baseTime = 1 / 48;
    const sameFormEfficiency = fixtures
      .filter((item) => item.lux !== null && item.form === fixture?.form && numericWatts(item.watts) > 0)
      .map((item) => item.lux! / numericWatts(item.watts));
    const allEfficiency = fixtures
      .filter((item) => item.lux !== null && numericWatts(item.watts) > 0)
      .map((item) => item.lux! / numericWatts(item.watts));
    const estimatedLux = Math.round((median(sameFormEfficiency) || median(allEfficiency)) * numericWatts(fixture?.watts ?? "0"));
    const referenceLux = meterLux ?? fixture?.lux ?? estimatedLux;
    const lightSource = meterLux ? "1m 实测校准" : fixture?.lux !== null ? "厂商照度规格" : "同类灯具功率—照度估算";
    // 800 lx is the 18% grey, ISO 800, T2.8, 1/48s calibrated baseline.
    const required =
      800 *
      (aperture / 2.8) ** 2 *
      (800 / iso) *
      (baseTime / exposureTime) *
      2 ** (nd + camera.lookOffset + offset + continuityStop) *
      (0.18 / subject);
    const actualDistance = Math.sqrt(distance ** 2 + (height - 1.63) ** 2);
    const fullKey = referenceLux * count * 2 ** (-diffusion - gel) * ((fixture?.referenceM ?? 1) / actualDistance) ** 2;
    const key = (fullKey * power) / 100;
    const total = ambient + key;
    const requiredKey = Math.max(0, required - ambient);
    const suggestedPower = fullKey > 0 ? Math.max(0, (requiredKey / fullKey) * 100) : 0;
    return {
      exposureTime,
      required,
      actualDistance,
      fullKey,
      key,
      total,
      requiredKey,
      suggestedPower,
      referenceLux,
      lightSource,
      subjectDelta: stop(total, required),
      ambientDelta: stop(ambient, required),
      ratio: stop(total, ambient),
    };
  }, [
    ambient,
    count,
    diffusion,
    distance,
    fixture,
    gel,
    height,
    iso,
    meterLux,
    nd,
    offset,
    power,
    shutterSpeed,
    subject,
    aperture,
    camera.lookOffset,
    continuityStop,
  ]);

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          别穿帮<span>灯光助手</span>
        </div>
        <div className="topnote">PHOTOMETRIC CONTINUITY · v2</div>
      </header>
      <section className="hero">
        <video
          className="hero-film"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-film-still.png"
        >
          <source src="/hero-forest-train.mp4" type="video/mp4" />
        </video>
        <div className="hero-copy">
          <h1>
            让每一盏灯的数字，
            <br />
            都接上上一镜的光。
          </h1>
        </div>
      </section>
      <section className="calc-shell">
        <div className="steps">
          <span className="active">
            <b>01</b>相机与环境
          </span>
          <i />
          <span className="active">
            <b>02</b>品牌与型号
          </span>
          <i />
          <span>
            <b>03</b>现场指令
          </span>
        </div>
        <div className="calculator-grid">
          <section className="inputs">
            <Panel title="品牌 → 型号" hint="来自中国市场影视灯品牌数据库">
              <div className="brand-list">
                {brands.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={
                      brand === item ? "brand-chip selected" : "brand-chip"
                    }
                    onClick={() => setBrand(item)}
                  >
                    {item}
                    <small>
                      {fixtures.filter((f) => f.brand === item).length}
                    </small>
                  </button>
                ))}
              </div>
              <div className="model-list">
                {models.map((item) => (
                  <button
                    key={item.model}
                    type="button"
                    className={
                      model === item.model
                        ? "model-card selected"
                        : "model-card"
                    }
                    onClick={() => setModel(item.model)}
                  >
                    <b>{item.model}</b>
                    <span>
                      {item.form} · {item.kind}
                    </span>
                    <em>{item.lux === null ? "自动估算 · 可用实测校准" : item.luxNote}</em>
                  </button>
                ))}
              </div>
              {fixture && (
                <div className="fixture-meta">
                  <span>{fixture.positioning}</span>
                  <b>{fixture.watts}W</b>
                  <span>{fixture.cct}</span>
                  <span>
                    CRI {fixture.cri} · TLCI {fixture.tlci}
                  </span>
                  <small>
                    规格：{fixture.luxNote}；附件／反光罩不同会改变实际输出。
                  </small>
                  {fixture.lux === null && (
                    <label className="meter-calibration">
                      <span>这款没有公开 lux：系统先按同类功率—照度模型估算；如有入射测光表，可录入 1m 实测 lux 覆盖。</span>
                      <input
                        type="number"
                        min="1"
                        placeholder={`当前估算 ${calc.referenceLux.toLocaleString()} lx`}
                        value={meterLux ?? ""}
                        onChange={(event) => setMeterLux(event.target.value ? Number(event.target.value) : null)}
                      />
                    </label>
                  )}
                </div>
              )}
            </Panel>
            <Panel title="上一镜 → 现在现场" hint="上传两张同机位照片，读取人物脸部与环境亮度">
              <div className="photo-compare">
                <label className="photo-slot">
                  <input type="file" accept="image/*" onChange={(event) => uploadPhoto(event, "previous")} />
                  {previousImage ? <img src={previousImage} alt="上一镜照片" /> : <><b>＋ 上一镜照片</b><small>点击选择剧照</small></>}
                </label>
                <label className="photo-slot">
                  <input type="file" accept="image/*" onChange={(event) => uploadPhoto(event, "current")} />
                  {currentImage ? <img src={currentImage} alt="现在现场照片" /> : <><b>＋ 现在现场照片</b><small>点击选择现场图</small></>}
                </label>
              </div>
              {previousReading && currentReading && photoDelta !== null && <div className="photo-result">
                <span>上一镜：脸部 {previousReading.face} / 环境 {previousReading.environment} / {previousReading.kelvin}K</span>
                <span>现在：脸部 {currentReading.face} / 环境 {currentReading.environment} / {currentReading.kelvin}K</span>
                <b>当前脸部相对上一镜 {signedStop(-photoDelta)}</b>
                <button type="button" className="preset active" onClick={() => { setContinuityStop(photoDelta); setNote(`已把上一镜到现在现场的 ${signedStop(photoDelta)} 亮度差计入本次照度目标。`); }}>把上一镜亮度应用为目标</button>
                {continuityStop !== 0 && <button type="button" className="preset" onClick={() => setContinuityStop(0)}>清除照片修正</button>}
              </div>}
            </Panel>
            <Panel
              title="相机曝光目标"
              hint="像调镜头一样选择每一档；相机预设会给出可继续微调的起点"
            >
              <div className="exposure-station">
                <div className="camera-profile">
                  <div>
                    <span>CAMERA / LOG PROFILE</span>
                    <b>选择你的机位</b>
                  </div>
                  <div className="camera-reel" role="group" aria-label="相机与 Log 或 LUT 预设">
                    {cameras.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cameraId === item.id ? "selected" : ""}
                        aria-pressed={cameraId === item.id}
                        onClick={() => {
                          setCameraId(item.id);
                          setIso(item.baseIso);
                          setOffset(item.lookOffset);
                        }}
                      >
                        <small>{item.label.split(" · ")[0]}</small>
                        <strong>{item.label.split(" · ")[1] ?? "Custom"}</strong>
                        <em>默认 {signedStop(item.lookOffset)}</em>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="exposure-controls">
                  <ExposureControl label="ISO" value={iso} setValue={setIso} options={[400, 800, 1250, 1600, 3200]} />
                  <ExposureControl label="光圈 / T 值" value={aperture} setValue={setAperture} options={[1.4, 2, 2.8, 4, 5.6, 8]} optionLabel={(value) => `T${value}`} variant="iris" inputStep={0.1} />
                  <ExposureControl label="帧率" value={fps} setValue={setFps} options={[24, 25, 30, 48, 60]} optionLabel={(value) => `${value}fps`} />
                  <ExposureControl label="快门速度" value={shutterSpeed} setValue={setShutterSpeed} options={[24, 30, 48, 50, 60, 96, 100, 120, 240]} optionLabel={(value) => `1/${value}`} variant="shutter" />
                  <ExposureControl label="ND 减光" value={nd} setValue={setNd} options={[0, 1, 2, 3, 4]} optionLabel={(value) => value === 0 ? "CLEAR" : `ND ${value}`} variant="nd" inputStep={0.1} />
                  <ExposureControl label="创意偏移" value={offset} setValue={setOffset} options={[-2, -1, -0.3, -0.2, 0, 0.2, 0.3, 1, 2]} optionLabel={(value) => `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)} EV`} variant="offset" inputStep={0.1} />
                </div>
                <p className="exposure-caption">
                  <span>EXPOSURE MAP</span> ISO {iso} · T{aperture} · 1/{shutterSpeed}s · ND {nd === 0 ? "CLEAR" : nd} · {signedStop(camera.lookOffset + offset)}
                </p>
              </div>
              <div className="preset-row">
                <b>主体反射率</b>
                {subjectPresets.map(([label, value]) => (
                  <button
                    className={subject === value ? "preset active" : "preset"}
                    onClick={() => setSubject(value)}
                    key={label}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Panel>
            <Panel
              title="环境与灯具设置"
              hint="环境光会与主光相加；柔光、色纸按透光损耗折算"
            >
              <div className="preset-row">
                <b>环境照度</b>
                {ambientPresets.map(([label, value]) => (
                  <button
                    className={ambient === value ? "preset active" : "preset"}
                    onClick={() => setAmbient(value)}
                    key={label}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Range
                label="环境照度（lx）"
                value={ambient}
                setValue={setAmbient}
                min={0}
                max={30000}
                step={10}
              />
              <div className="control-grid">
                <Select
                  label="灯头数量"
                  value={count}
                  setValue={setCount}
                  options={[1, 2, 3, 4]}
                />
                <Select
                  label="柔光损失"
                  value={diffusion}
                  setValue={setDiffusion}
                  options={diffusionPresets.map((x) => x[1])}
                  optionLabel={(x) => `${x} 档`}
                />
                <Select
                  label="色纸损失"
                  value={gel}
                  setValue={setGel}
                  options={gelPresets.map((x) => x[1])}
                  optionLabel={(x) => `${x} 档`}
                />
              </div>
              <Range
                label="灯到人物水平距离（m）"
                value={distance}
                setValue={setDistance}
                min={0.5}
                max={12}
                step={0.1}
              />
              <Range
                label="灯高（m，人物眼高按 1.63m）"
                value={height}
                setValue={setHeight}
                min={1}
                max={6}
                step={0.1}
              />
              <Range
                label="当前调光（%）"
                value={power}
                setValue={setPower}
                min={1}
                max={100}
                step={1}
              />
            </Panel>
          </section>
          <aside className="results">
            <div className="result-kicker">LIVE PHOTOMETRY</div>
            <h2>现场调灯指令</h2>
            <>
                <div className="hero-metric">
                  <small>所需人物照度</small>
                  <strong>
                    {Math.round(calc.required).toLocaleString()}
                    <sup> lx</sup>
                  </strong>
                  <span>
                    {camera.label} · ISO {iso} · T{aperture} · 1/{shutterSpeed}s · {fps}fps · ND {nd} · 合计创意偏移 {signedStop(camera.lookOffset + offset)}
                  </span>
                </div>
                <div className="metric-grid">
                  <Metric
                    label="主光实际输出"
                    value={`${Math.round(calc.key).toLocaleString()} lx`}
                    hint={`${calc.lightSource} ${calc.referenceLux.toLocaleString()} lx → 实际 ${calc.actualDistance.toFixed(2)}m`}
                  />
                  <Metric
                    label="人物总照度"
                    value={`${Math.round(calc.total).toLocaleString()} lx`}
                    hint={`环境 ${ambient.toLocaleString()} lx + 主光`}
                  />
                  <Metric
                    label="人物对目标"
                    value={signedStop(calc.subjectDelta)}
                    hint={
                      calc.subjectDelta >= -0.1 &&
                      calc.subjectDelta <= 0.1
                        ? "曝光对齐"
                        : "建议继续微调"
                    }
                  />
                  <Metric
                    label="人物对环境"
                    value={signedStop(calc.ratio ?? 0)}
                    hint={`环境对目标 ${signedStop(calc.ambientDelta)}`}
                  />
                </div>
                <div className="instruction jade-flow">
                  <span>建议主光</span>
                  <h3>
                    {fixture?.brand} · {fixture?.model}
                  </h3>
                  <div className="power-line">
                    <b>
                      {`${Math.round(calc.suggestedPower)}%`}
                    </b>
                    <p>
                      距离人物实际{" "}
                      <strong>{calc.actualDistance.toFixed(2)}m</strong>
                      <br />
                      柔光／色纸共损失{" "}
                      <strong>{(diffusion + gel).toFixed(1)} 档</strong>
                    </p>
                  </div>
                  <small>
                    {calc.suggestedPower > 100
                      ? "这盏灯在当前距离与附件下功率不足：靠近、减柔光、加灯或换更强型号。"
                      : "以入射式测光表在人物脸前复核；每次以 5% 微调。"}
                  </small>
                </div>
            </>
            <p className="calc-note">{note}</p>
            <details>
              <summary>计算原理与使用边界</summary>
              <p>
                目标照度以 ISO 800、T2.8、1/48s、18%灰卡下的 800 lx
                为校准基线，随后按 ISO、光圈平方、快门速度、ND、相机预设／创意偏移与反射率换算。灯具输出优先采用资料表的厂商照度与参考距离；没有 lux 的型号则以同灯型、同功率段的中位照度效率估算，并可用 1m 实测 lux 覆盖校准。之后叠加灯数、调光、柔光／色纸透光率，再用平方反比和三维距离计算。
              </p>
            </details>
          </aside>
        </div>
      </section>
      <footer>
        别穿帮灯光助手 · 数据源：中国市场影视灯品牌数据库（用户提供） · 方法参考
        LightCalc 的公开光度学框架。
      </footer>
    </main>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <small>{hint}</small>
      </div>
      {children}
    </section>
  );
}
function Select({
  label,
  value,
  setValue,
  options,
  suffix = "",
  optionLabel,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  options: readonly number[];
  suffix?: string;
  optionLabel?: (value: number) => string;
}) {
  return (
    <label className="select-label">
      {label}
      <select value={value} onChange={(e) => setValue(Number(e.target.value))}>
        {options.map((item) => (
          <option key={item} value={item}>
            {optionLabel ? optionLabel(item) : `${item}${suffix}`}
          </option>
        ))}
      </select>
    </label>
  );
}
function ExposureControl({
  label,
  value,
  setValue,
  options,
  optionLabel = (item) => String(item),
  variant = "",
  inputStep = 1,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  options: readonly number[];
  optionLabel?: (value: number) => string;
  variant?: string;
  inputStep?: number;
}) {
  return (
    <section className={`exposure-control ${variant}`}>
      <div className="exposure-control-head">
        <span>{label}</span>
        <b>{optionLabel(value)}</b>
      </div>
      <div className="exposure-ticks" role="group" aria-label={label}>
        {options.map((item) => (
          <button
            key={item}
            type="button"
            className={value === item ? "selected" : ""}
            aria-pressed={value === item}
            onClick={() => setValue(item)}
          >
            <i />
            <span>{optionLabel(item)}</span>
          </button>
        ))}
      </div>
      <label className="exposure-custom">
        <span>精确输入</span>
        <input
          key={`${label}-${value}`}
          type="number"
          defaultValue={value}
          step={inputStep}
          inputMode="decimal"
          aria-label={`${label}精确输入`}
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) setValue(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </label>
    </section>
  );
}
function Range({
  label,
  value,
  setValue,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="range-label">
      {label}
      <output>{value}</output>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </label>
  );
}
function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="metric">
      <small>{label}</small>
      <b>{value}</b>
      <span>{hint}</span>
    </div>
  );
}

function analyzePhoto(file: File): Promise<PhotoReading> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = 180;
      const height = Math.max(1, Math.round((image.height / image.width) * width));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return reject(new Error("canvas unavailable"));
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      let faceLuma = 0, faceCount = 0, envLuma = 0, envCount = 0, red = 0, blue = 0;
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const luminance = .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2];
        const isFaceZone = x > width * .31 && x < width * .69 && y > height * .18 && y < height * .7;
        if (isFaceZone) { faceLuma += luminance; faceCount += 1; red += pixels[index]; blue += pixels[index + 2]; }
        else { envLuma += luminance; envCount += 1; }
      }
      const kelvin = Math.round(Math.max(2800, Math.min(7500, 5600 + (1 - red / Math.max(1, blue)) * 3300)) / 100) * 100;
      resolve({ face: Math.round(faceLuma / Math.max(1, faceCount) / 255 * 100), environment: Math.round(envLuma / Math.max(1, envCount) / 255 * 100), kelvin });
    };
    image.onerror = () => reject(new Error("image failed"));
    image.src = URL.createObjectURL(file);
  });
}
