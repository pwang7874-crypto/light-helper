import { fixtures as legacyFixtures, type Fixture } from "./fixtures";
import { verifiedLights } from "./verified-lighting-data";

export type DataConfidence = "official" | "catalog" | "estimated";

export type PhotometricPoint = {
  cct: number;
  lux: number;
};

export type FixtureProfile = Fixture & {
  id: string;
  wattage: number;
  referenceLux: number;
  cctMin: number;
  cctMax: number;
  dataConfidence: DataConfidence;
  dataLabel: string;
  sourceUrl: string | null;
  testedCct: number | null;
  testedModifier: string;
  photometricsByCct: PhotometricPoint[];
  linearCurveDocumented: boolean;
};

type OfficialFixture = Fixture & {
  sourceUrl: string;
  testedCct: number;
  testedModifier: string;
  photometricsByCct?: PhotometricPoint[];
};

const ZHIYUN_B_SOURCE =
  "https://www.zhiyun-tech.com/en/product/param/924";

const officialFixtures: OfficialFixture[] = [
  {
    brand: "智云 ZHIYUN",
    model: "MOLUS G300",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "300(超频500)",
    lux: 61000,
    referenceM: 1,
    luxNote: "61,000@1m(5500K/标配反光罩)",
    cct: "2700-6500",
    cri: "≥95",
    tlci: "≥97",
    mount: "保荣口",
    positioning: "便携大功率双色温主光",
    sourceUrl:
      "https://www.zhiyun-tech.com/en/product/param/934?page=second_nav&source=param&type=website",
    testedCct: 5500,
    testedModifier: "标配反光罩",
    photometricsByCct: [
      { cct: 2700, lux: 46600 },
      { cct: 3200, lux: 52500 },
      { cct: 4300, lux: 58800 },
      { cct: 5500, lux: 61000 },
      { cct: 6500, lux: 60900 },
    ],
  },
  {
    brand: "智云 ZHIYUN",
    model: "MOLUS B100",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "100",
    lux: 20600,
    referenceM: 1,
    luxNote: "20,600@1m(5500K/标配反光罩)",
    cct: "2700-6500",
    cri: "≥96",
    tlci: "≥96",
    mount: "保荣口",
    positioning: "入门双色温影视灯",
    sourceUrl: ZHIYUN_B_SOURCE,
    testedCct: 5500,
    testedModifier: "标配反光罩",
    photometricsByCct: [
      { cct: 2700, lux: 16700 },
      { cct: 3200, lux: 18500 },
      { cct: 4300, lux: 20400 },
      { cct: 5500, lux: 20600 },
      { cct: 6500, lux: 19400 },
    ],
  },
  {
    brand: "智云 ZHIYUN",
    model: "MOLUS B200",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "200",
    lux: 39900,
    referenceM: 1,
    luxNote: "39,900@1m(5500K/标配反光罩)",
    cct: "2700-6500",
    cri: "≥96",
    tlci: "≥96",
    mount: "保荣口",
    positioning: "中功率双色温影视灯",
    sourceUrl: ZHIYUN_B_SOURCE,
    testedCct: 5500,
    testedModifier: "标配反光罩",
    photometricsByCct: [
      { cct: 2700, lux: 31100 },
      { cct: 3200, lux: 34300 },
      { cct: 4300, lux: 39400 },
      { cct: 5500, lux: 39900 },
      { cct: 6500, lux: 39900 },
    ],
  },
  {
    brand: "智云 ZHIYUN",
    model: "MOLUS B300",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "300",
    lux: 63200,
    referenceM: 1,
    luxNote: "63,200@1m(5500K/标配反光罩)",
    cct: "2700-6500",
    cri: "≥95",
    tlci: "≥97",
    mount: "保荣口",
    positioning: "专业双色温主光",
    sourceUrl: ZHIYUN_B_SOURCE,
    testedCct: 5500,
    testedModifier: "标配反光罩",
    photometricsByCct: [
      { cct: 2700, lux: 52000 },
      { cct: 3200, lux: 57300 },
      { cct: 4300, lux: 62600 },
      { cct: 5500, lux: 63200 },
      { cct: 6500, lux: 62200 },
    ],
  },
  {
    brand: "智云 ZHIYUN",
    model: "MOLUS B500",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "500",
    lux: 76400,
    referenceM: 1,
    luxNote: "76,400@1m(5500K/标配反光罩)",
    cct: "2700-6500",
    cri: "≥95",
    tlci: "≥97",
    mount: "保荣口",
    positioning: "大功率双色温主光",
    sourceUrl: ZHIYUN_B_SOURCE,
    testedCct: 5500,
    testedModifier: "标配反光罩",
    photometricsByCct: [
      { cct: 2700, lux: 60900 },
      { cct: 3200, lux: 67800 },
      { cct: 4300, lux: 75300 },
      { cct: 5500, lux: 76400 },
      { cct: 6500, lux: 74900 },
    ],
  },
  {
    brand: "优篮子 Ulanzi",
    model: "VL-120Bi",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "120",
    lux: 20700,
    referenceM: 1,
    luxNote: "20,700@1m(6500K/官方测试配置)",
    cct: "2700-6500",
    cri: ">95",
    tlci: "—",
    mount: "保荣口",
    positioning: "学生与小型剧组便携主光",
    sourceUrl:
      "https://www.ulanzi.com/collections/ulanzi-120w-video-light-with-45cm-softbox-kit",
    testedCct: 6500,
    testedModifier: "官方测试配置",
  },
  {
    brand: "优篮子 Ulanzi",
    model: "VL110 RGB棒灯",
    form: "RGB棒灯",
    kind: "RGB全彩",
    watts: "10",
    lux: 66.8,
    referenceM: 1,
    luxNote: "66.8@1m(裸灯)",
    cct: "2500-9000",
    cri: ">95",
    tlci: "—",
    mount: "磁吸/1/4螺口",
    positioning: "便携氛围与轮廓光",
    sourceUrl:
      "https://www.ulanzi.com/en-au/products/ulanzi-vl110-magnetic-rgb-tube-light-2660",
    testedCct: 5600,
    testedModifier: "裸灯",
  },
  {
    brand: "斯莫格 SmallRig",
    model: "RC 220B",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "220",
    lux: 84500,
    referenceM: 1,
    luxNote: "84,500@1m(5600K/Hyper Reflector)",
    cct: "2700-6500",
    cri: "≥95",
    tlci: "≥96",
    mount: "保荣口",
    positioning: "中功率双色温主光",
    sourceUrl:
      "https://www.smallrig.com/smallrig-rc-220b-point-source-video-light-american-standard-3473.html",
    testedCct: 5600,
    testedModifier: "Hyper Reflector",
  },
  {
    brand: "斯莫格 SmallRig",
    model: "RC 350B",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "350",
    lux: 115000,
    referenceM: 1,
    luxNote: "115,000@1m(官方反光罩)",
    cct: "2700-6500",
    cri: "≥96",
    tlci: "≥97",
    mount: "保荣口",
    positioning: "专业双色温主光",
    sourceUrl:
      "https://www.smallrig.com/global/blog/enhance-your-lighting-setup-with-smallrig-cob-led-video-lights",
    testedCct: 5600,
    testedModifier: "官方反光罩",
  },
  {
    brand: "COLBOR",
    model: "CL220",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "220",
    lux: 52700,
    referenceM: 1,
    luxNote: "52,700@1m(5600K/标配反光罩)",
    cct: "2700-6500",
    cri: "≥97",
    tlci: "—",
    mount: "保荣口",
    positioning: "直播与小型剧组主光",
    sourceUrl: "https://www.colborlight.com/products/co-cl220",
    testedCct: 5600,
    testedModifier: "标配反光罩",
  },
  {
    brand: "COLBOR",
    model: "CL220R",
    form: "COB聚光灯",
    kind: "RGB全彩",
    watts: "220",
    lux: 30600,
    referenceM: 1,
    luxNote: "30,600@1m(5600K/BHR45反光罩)",
    cct: "2700-6500",
    cri: "≥96",
    tlci: "≥97",
    mount: "保荣口",
    positioning: "RGB全彩主光",
    sourceUrl: "https://www.colborlight.com/products/co-cl220r",
    testedCct: 5600,
    testedModifier: "BHR45反光罩",
  },
  {
    brand: "纽尔 NEEWER",
    model: "CB200B",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "210",
    lux: 90000,
    referenceM: 1,
    luxNote: "90,000@1m(标配反光罩)",
    cct: "2700-6500",
    cri: "≥97",
    tlci: "≥97",
    mount: "保荣口",
    positioning: "直播与商业拍摄主光",
    sourceUrl:
      "https://eu.neewer.com/collections/all-products/products/neewer-cb200b-200w-led-video-light-support-2-4g-app-remote-control-66602646",
    testedCct: 5600,
    testedModifier: "标配反光罩",
  },
  {
    brand: "纽尔 NEEWER",
    model: "MS60B",
    form: "COB聚光灯",
    kind: "双色温(Bi)",
    watts: "65",
    lux: 40000,
    referenceM: 1,
    luxNote: "40,000@1m(官方测试配置)",
    cct: "2700-6500",
    cri: "≥97",
    tlci: "≥97",
    mount: "NEEWER/保荣转接",
    positioning: "便携双色温灯",
    sourceUrl:
      "https://ca.neewer.com/fr/blogs/blog/professional-lighting-in-your-hand",
    testedCct: 5600,
    testedModifier: "官方测试配置",
  },
];

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");

const fixtureId = (fixture: Fixture) =>
  `${normalize(fixture.brand)}-${normalize(fixture.model)}`;

export const numericWatts = (watts: string) =>
  Number((watts.match(/[0-9]+(?:\.[0-9]+)?/) ?? ["0"])[0]);

const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  if (!ordered.length) return 0;
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
};

export function parseCctRange(cct: string) {
  if (/全色域|全彩/.test(cct)) return { min: 2000, max: 10000 };
  const range = cct.match(/(\d{4,5})\s*[-~—]\s*(\d{4,5})/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const value = Number(cct.match(/\d{4,5}/)?.[0] ?? 5600);
  return { min: value, max: value };
}

const verifiedByModel = new Map(
  verifiedLights.map((item) => [normalize(item.model), item]),
);

const allFixtures: Array<Fixture | OfficialFixture> = [
  ...legacyFixtures,
  ...officialFixtures,
  {
    brand: "自定义灯具",
    model: "找不到型号时使用",
    form: "COB聚光灯",
    kind: "自定义",
    watts: "100",
    lux: null,
    referenceM: 1,
    luxNote: "请输入1m/100%实测照度",
    cct: "2700-6500",
    cri: "—",
    tlci: "—",
    mount: "自定义",
    positioning: "覆盖数据库中暂未收录的灯具",
  },
];

const initialProfiles = allFixtures.map((fixture): FixtureProfile => {
  const official = verifiedByModel.get(normalize(fixture.model));
  const embeddedOfficial = "sourceUrl" in fixture ? fixture : null;
  const verifiedLux = official?.modifierLux ?? official?.bareLux ?? null;
  const approximate = /约|>|极高|—/.test(fixture.luxNote);
  const confidence: DataConfidence =
    official || embeddedOfficial
      ? "official"
      : fixture.lux !== null && !approximate
        ? "catalog"
        : "estimated";
  const cct = parseCctRange(fixture.cct);
  const referenceLux = verifiedLux ?? fixture.lux ?? 0;
  const sourceUrl = official?.source ?? embeddedOfficial?.sourceUrl ?? null;
  const testedModifier =
    official?.modifier ?? embeddedOfficial?.testedModifier ??
    (fixture.luxNote.includes("裸灯") ? "裸灯" : "资料表测试配置");
  const testedCct =
    official?.cct ?? embeddedOfficial?.testedCct ??
    (fixture.luxNote.match(/(\d{4,5})K/)?.[1]
      ? Number(fixture.luxNote.match(/(\d{4,5})K/)?.[1])
      : null);

  return {
    ...fixture,
    id: fixtureId(fixture),
    wattage: numericWatts(fixture.watts),
    referenceLux,
    cctMin: cct.min,
    cctMax: cct.max,
    dataConfidence: confidence,
    dataLabel:
      confidence === "official"
        ? "官方资料"
        : confidence === "catalog"
          ? "品牌数据库"
          : "估算资料",
    sourceUrl,
    testedCct,
    testedModifier,
    photometricsByCct: embeddedOfficial?.photometricsByCct ?? [],
    linearCurveDocumented: /Aputure|amaran/.test(fixture.brand),
  };
});

const knownProfiles = initialProfiles.filter(
  (fixture) => fixture.referenceLux > 0 && fixture.wattage > 0,
);

export const fixtureProfiles = initialProfiles.map((fixture) => {
  if (fixture.referenceLux > 0 || fixture.wattage <= 0) return fixture;
  const sameForm = knownProfiles
    .filter((item) => item.form === fixture.form)
    .map((item) => item.referenceLux / item.wattage);
  const all = knownProfiles.map(
    (item) => item.referenceLux / item.wattage,
  );
  return {
    ...fixture,
    referenceLux: Math.round((median(sameForm) || median(all)) * fixture.wattage),
    dataConfidence: "estimated" as const,
    dataLabel: "同灯型估算",
  };
});

export const brands = [...new Set(fixtureProfiles.map((item) => item.brand))];

export const confidenceLabel: Record<DataConfidence, string> = {
  official: "高",
  catalog: "中",
  estimated: "低",
};
