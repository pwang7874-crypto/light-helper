"use client";

import { useEffect, useMemo, useState } from "react";
import { fixtures } from "./fixtures";

const ambientPresets = [
  ["黑棚 / 夜内", 10], ["昏暗室内", 75], ["普通室内", 250],
  ["窗边日光", 750], ["阴天外景", 5000], ["晴天外景", 25000],
] as const;
const subjectPresets = [["18% 灰卡", .18], ["中等肤色", .23], ["浅肤色", .36], ["深肤色", .11], ["白色背景", .85], ["黑色织物", .04]] as const;
const diffusionPresets = [["无柔光", 0], ["轻柔光", .5], ["Lee 216 白柔光", 1], ["网格布 / 重柔光", 2]] as const;
const gelPresets = [["无色纸", 0], ["1/2 CTO", .5], ["Full CTO", 1], ["深色效果纸", 1.5]] as const;
const stop = (value: number, target: number) => Math.log2(Math.max(value, .01) / Math.max(target, .01));
const signedStop = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)} 档`;

export default function Home() {
  const brands = useMemo(() => [...new Set(fixtures.map((item) => item.brand))], []);
  const [brand, setBrand] = useState(brands[0]);
  const models = useMemo(() => fixtures.filter((item) => item.brand === brand), [brand]);
  const [model, setModel] = useState(models[0]?.model ?? "");
  const [iso, setIso] = useState(800);
  const [tStop, setTStop] = useState(2.8);
  const [fps, setFps] = useState(24);
  const [shutter, setShutter] = useState(180);
  const [nd, setNd] = useState(0);
  const [offset, setOffset] = useState(0);
  const [subject, setSubject] = useState(.23);
  const [ambient, setAmbient] = useState(250);
  const [distance, setDistance] = useState(2);
  const [height, setHeight] = useState(1.9);
  const [power, setPower] = useState(50);
  const [count, setCount] = useState(1);
  const [diffusion, setDiffusion] = useState(1);
  const [gel, setGel] = useState(0);
  const [note, setNote] = useState("选择品牌与型号后，数据会按厂商标注的照度规格实时计算。");
  const fixture = fixtures.find((item) => item.brand === brand && item.model === model) ?? models[0];

  useEffect(() => setModel(models[0]?.model ?? ""), [brand, models]);
  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>(".hero-film");
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const drift = () => {
      video.style.objectPosition = `${44 + Math.random() * 12}% ${45 + Math.random() * 10}%`;
      video.style.transform = `scale(${1.035 + Math.random() * .035})`;
    };
    drift(); const timer = window.setInterval(drift, 6800); return () => window.clearInterval(timer);
  }, []);

  const calc = useMemo(() => {
    const exposureTime = shutter / (360 * fps);
    const baseTime = 1 / 48;
    // 800 lx is the 18% grey, ISO 800, T2.8, 24 fps / 180° calibrated baseline.
    const required = 800 * (tStop / 2.8) ** 2 * (800 / iso) * (baseTime / exposureTime) * 2 ** (nd + offset) * (.18 / subject);
    const actualDistance = Math.sqrt(distance ** 2 + (height - 1.63) ** 2);
    const fullKey = fixture?.lux === null || !fixture ? null : fixture.lux * count * 2 ** (-diffusion - gel) * (fixture.referenceM / actualDistance) ** 2;
    const key = fullKey === null ? null : fullKey * power / 100;
    const total = key === null ? null : ambient + key;
    const requiredKey = Math.max(0, required - ambient);
    const suggestedPower = fullKey && fullKey > 0 ? Math.min(100, Math.max(0, requiredKey / fullKey * 100)) : null;
    return { exposureTime, required, actualDistance, fullKey, key, total, requiredKey, suggestedPower,
      subjectDelta: total === null ? null : stop(total, required), ambientDelta: stop(ambient, required), ratio: total === null ? null : stop(total, ambient) };
  }, [ambient, count, diffusion, distance, fixture, fps, gel, height, iso, nd, offset, power, shutter, subject, tStop]);

  return <main>
    <header className="topbar"><div className="brand">别穿帮<span>灯光助手</span></div><div className="topnote">PHOTOMETRIC CONTINUITY · v2</div></header>
    <section className="hero">
      <video className="hero-film" autoPlay muted loop playsInline poster="/hero-film-still.png"><source src="/hero-film-motion.mp4" type="video/mp4" /></video>
      <div className="hero-copy"><h1>让每一盏灯的数字，<br/>都接上上一镜的光。</h1></div>
    </section>
    <section className="calc-shell">
      <div className="steps"><span className="active"><b>01</b>相机与环境</span><i/><span className="active"><b>02</b>品牌与型号</span><i/><span><b>03</b>现场指令</span></div>
      <div className="calculator-grid">
        <section className="inputs">
          <Panel title="品牌 → 型号" hint="来自中国市场影视灯品牌数据库">
            <div className="brand-list">{brands.map((item) => <button key={item} type="button" className={brand === item ? "brand-chip selected" : "brand-chip"} onClick={() => setBrand(item)}>{item}<small>{fixtures.filter((f) => f.brand === item).length}</small></button>)}</div>
            <div className="model-list">{models.map((item) => <button key={item.model} type="button" className={model === item.model ? "model-card selected" : "model-card"} onClick={() => setModel(item.model)}><b>{item.model}</b><span>{item.form} · {item.kind}</span><em>{item.lux === null ? "需补测照度" : item.luxNote}</em></button>)}</div>
            {fixture && <div className="fixture-meta"><span>{fixture.positioning}</span><b>{fixture.watts}W</b><span>{fixture.cct}</span><span>CRI {fixture.cri} · TLCI {fixture.tlci}</span><small>规格：{fixture.luxNote}；附件／反光罩不同会改变实际输出。</small></div>}
          </Panel>
          <Panel title="相机曝光目标" hint="用 T 值、快门、ND 和主体反射率推导所需照度">
            <div className="control-grid"><Select label="ISO" value={iso} setValue={setIso} options={[400, 800, 1250, 1600, 3200]}/><Select label="T 值" value={tStop} setValue={setTStop} options={[1.4, 2, 2.8, 4, 5.6, 8]}/><Select label="帧率" value={fps} setValue={setFps} options={[24, 25, 30, 48, 60]}/><Select label="快门角度" value={shutter} setValue={setShutter} options={[90, 144, 180, 270, 360]} suffix="°"/><Select label="ND 减光" value={nd} setValue={setNd} options={[0, 1, 2, 3, 4]} suffix=" 档"/><Select label="创意偏移" value={offset} setValue={setOffset} options={[-2, -1, 0, 1, 2]} suffix=" 档"/></div>
            <div className="preset-row"><b>主体反射率</b>{subjectPresets.map(([label, value]) => <button className={subject === value ? "preset active" : "preset"} onClick={() => setSubject(value)} key={label}>{label}</button>)}</div>
          </Panel>
          <Panel title="环境与灯具设置" hint="环境光会与主光相加；柔光、色纸按透光损耗折算">
            <div className="preset-row"><b>环境照度</b>{ambientPresets.map(([label, value]) => <button className={ambient === value ? "preset active" : "preset"} onClick={() => setAmbient(value)} key={label}>{label}</button>)}</div>
            <Range label="环境照度（lx）" value={ambient} setValue={setAmbient} min={0} max={30000} step={10}/>
            <div className="control-grid"><Select label="灯头数量" value={count} setValue={setCount} options={[1,2,3,4]}/><Select label="柔光损失" value={diffusion} setValue={setDiffusion} options={diffusionPresets.map((x)=>x[1])} optionLabel={(x)=>`${x} 档`}/><Select label="色纸损失" value={gel} setValue={setGel} options={gelPresets.map((x)=>x[1])} optionLabel={(x)=>`${x} 档`}/></div>
            <Range label="灯到人物水平距离（m）" value={distance} setValue={setDistance} min={.5} max={12} step={.1}/><Range label="灯高（m，人物眼高按 1.63m）" value={height} setValue={setHeight} min={1} max={6} step={.1}/><Range label="当前调光（%）" value={power} setValue={setPower} min={1} max={100} step={1}/>
          </Panel>
        </section>
        <aside className="results">
          <div className="result-kicker">LIVE PHOTOMETRY</div><h2>现场调灯指令</h2>
          {fixture?.lux === null ? <div className="warning-card"><b>这款型号暂不能精算</b><p>数据表仅给出了流明或定性输出，没有可换算的照度与参考距离。仍可保留为器材档案；请用入射式测光表补录 lux 后再计算。</p></div> : <>
            <div className="hero-metric"><small>所需人物照度</small><strong>{Math.round(calc.required).toLocaleString()}<sup> lx</sup></strong><span>ISO {iso} · T{tStop} · 1/{Math.round(1/calc.exposureTime)}s · 反射率 {Math.round(subject*100)}%</span></div>
            <div className="metric-grid"><Metric label="主光实际输出" value={`${Math.round(calc.key ?? 0).toLocaleString()} lx`} hint={`${fixture?.luxNote} → 实际 ${calc.actualDistance.toFixed(2)}m`}/><Metric label="人物总照度" value={`${Math.round(calc.total ?? 0).toLocaleString()} lx`} hint={`环境 ${ambient.toLocaleString()} lx + 主光`}/><Metric label="人物对目标" value={signedStop(calc.subjectDelta ?? 0)} hint={(calc.subjectDelta ?? 0) >= -.1 && (calc.subjectDelta ?? 0) <= .1 ? "曝光对齐" : "建议继续微调"}/><Metric label="人物对环境" value={signedStop(calc.ratio ?? 0)} hint={`环境对目标 ${signedStop(calc.ambientDelta)}`}/></div>
            <div className="instruction"><span>建议主光</span><h3>{fixture?.brand} · {fixture?.model}</h3><div className="power-line"><b>{calc.suggestedPower === null ? "—" : `${Math.round(calc.suggestedPower)}%`}</b><p>距离人物实际 <strong>{calc.actualDistance.toFixed(2)}m</strong><br/>柔光／色纸共损失 <strong>{(diffusion + gel).toFixed(1)} 档</strong></p></div><small>{calc.suggestedPower !== null && calc.suggestedPower > 100 ? "这盏灯在当前距离与附件下功率不足：靠近、减柔光、加灯或换更强型号。" : "以入射式测光表在人物脸前复核；每次以 5% 微调。"}</small></div>
            <button className="apply" onClick={() => { if (calc.suggestedPower !== null) { setPower(Math.round(calc.suggestedPower)); setNote("已把当前灯的调光设为物理计算建议值；请以现场测光表复核。"); } }}>应用建议功率</button>
          </>}
          <p className="calc-note">{note}</p>
          <details><summary>计算原理与使用边界</summary><p>目标照度以 ISO 800、T2.8、24fps/180°、18%灰卡下的 800 lx 为校准基线，随后按 ISO、T 值平方、曝光时间、ND／创意偏移与反射率换算。灯具输出使用资料表中的厂商照度与标注参考距离，叠加灯数、调光、柔光／色纸透光率，再用平方反比和三维距离计算。未提供可用 lux 规格的型号不会伪造精度。</p></details>
        </aside>
      </div>
    </section>
    <footer>别穿帮灯光助手 · 数据源：中国市场影视灯品牌数据库（用户提供） · 方法参考 LightCalc 的公开光度学框架。</footer>
  </main>;
}

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) { return <section className="panel"><div className="panel-head"><h2>{title}</h2><small>{hint}</small></div>{children}</section>; }
function Select({ label, value, setValue, options, suffix = "", optionLabel }: { label: string; value: number; setValue: (value: number) => void; options: readonly number[]; suffix?: string; optionLabel?: (value: number) => string }) { return <label className="select-label">{label}<select value={value} onChange={(e) => setValue(Number(e.target.value))}>{options.map((item) => <option key={item} value={item}>{optionLabel ? optionLabel(item) : `${item}${suffix}`}</option>)}</select></label>; }
function Range({ label, value, setValue, min, max, step }: { label: string; value: number; setValue: (value: number) => void; min: number; max: number; step: number }) { return <label className="range-label">{label}<output>{value}</output><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(Number(e.target.value))}/></label>; }
function Metric({ label, value, hint }: { label: string; value: string; hint: string }) { return <div className="metric"><small>{label}</small><b>{value}</b><span>{hint}</span></div>; }
