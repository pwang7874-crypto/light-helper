import { type ReactNode, useEffect, useState } from "react";

const GUIDE_KEY = "lighting-helper-guide-seen-v1";

const steps = [
  {
    eyebrow: "第 1 步 · 选灯",
    title: "先告诉助手，你现场有什么灯",
    copy: "按品牌筛选，再选择最接近的具体型号。这里的“最接近”优先看品牌、灯具类型、功率和输出能力，不只是瓦数。",
    items: ["选择品牌", "搜索型号", "确认灯数与柔光附件"],
  },
  {
    eyebrow: "第 2 步 · 对照片",
    title: "上一镜和现场，各放一张参考照片",
    copy: "上一镜提供要延续的脸部与环境亮度，现场照片提供现在的光。尽量保持相同相机、曝光和构图，结果会更可靠。",
    items: ["上传上一镜", "上传现场环境", "确认相机参数一致"],
  },
  {
    eyebrow: "第 3 步 · 填现场",
    title: "输入剧组真正会用到的条件",
    copy: "填写灯到人物的距离、环境明暗、色温和柔光损失。专业模式还可以补充 ISO、光圈、帧率与快门角度。",
    items: ["距离与高度", "环境亮度与色温", "ISO / 光圈 / 快门"],
  },
  {
    eyebrow: "第 4 步 · 照着调",
    title: "直接拿走灯具档位和色温",
    copy: "结果页会给出确切功率百分比、色温、灯距和是否需要色纸。调好后保存镜次，下次拍摄可直接载入对照。",
    items: ["功率 1%–100%", "色温与校色建议", "保存镜次记录"],
  },
] as const;

const firstVisit = () =>
  typeof window === "undefined" ||
  window.localStorage.getItem(GUIDE_KEY) !== "done";

export function FirstRunGuide({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(firstVisit);
  const [step, setStep] = useState(0);
  const current = steps[step];

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.localStorage.setItem(GUIDE_KEY, "done");
        setOpen(false);
        setStep(0);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const finish = () => {
    window.localStorage.setItem(GUIDE_KEY, "done");
    setOpen(false);
    setStep(0);
  };

  const reopen = () => {
    setStep(0);
    setOpen(true);
  };

  return (
    <>
      {children}
      <button className="guide-reopen" type="button" onClick={reopen}>
        使用教程
      </button>

      {open && (
        <div className="guide-overlay" role="presentation">
          <section
            className="guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
          >
            <header className="guide-header">
              <div>
                <span className="guide-badge">片场上手指南</span>
                <span className="guide-count">
                  {step + 1} / {steps.length}
                </span>
              </div>
              <button type="button" onClick={finish} aria-label="关闭教程">
                跳过
              </button>
            </header>

            <div className="guide-progress" aria-hidden="true">
              {steps.map((item, index) => (
                <span
                  className={index <= step ? "active" : ""}
                  key={item.eyebrow}
                />
              ))}
            </div>

            <div className="guide-content">
              <p className="guide-eyebrow">{current.eyebrow}</p>
              <h2 id="guide-title">{current.title}</h2>
              <p className="guide-copy">{current.copy}</p>
              <ol className="guide-checklist">
                {current.items.map((item, index) => (
                  <li key={item}>
                    <span>{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>

            <footer className="guide-actions">
              <button
                className="guide-secondary"
                type="button"
                disabled={step === 0}
                onClick={() => setStep((value) => Math.max(0, value - 1))}
              >
                上一步
              </button>
              <button
                className="guide-primary"
                type="button"
                onClick={() => {
                  if (step === steps.length - 1) finish();
                  else setStep((value) => value + 1);
                }}
              >
                {step === steps.length - 1 ? "开始计算" : "下一步"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
