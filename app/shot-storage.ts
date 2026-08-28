import type { CurveMode } from "./lighting-core";
import type { PhotoReading } from "./photo-analysis";

export type CalculatorSnapshot = {
  fixtureId: string;
  iso: number;
  aperture: number;
  fps: number;
  shutterAngle: number;
  ndStops: number;
  exposureCompensationStops: number;
  ambientLux: number;
  ambientCct: number;
  targetCct: number;
  distance: number;
  lampHeight: number;
  lightCount: number;
  modifierLossStops: number;
  currentPower: number;
  curveMode: CurveMode;
  meterLux: number | null;
  photoApplied: boolean;
  previousReading: PhotoReading | null;
  currentReading: PhotoReading | null;
};

export type SavedShot = {
  id: string;
  version: 3;
  project: string;
  scene: string;
  shot: string;
  createdAt: string;
  updatedAt: string;
  snapshot: CalculatorSnapshot;
  result: {
    fixture: string;
    power: number;
    powerLow: number;
    powerHigh: number;
    cct: number;
    gel: string;
    confidence: "高" | "中" | "低";
  };
};

const STORAGE_KEY = "lighting-helper-shots-v3";
const MAX_RECORDS = 100;

const isSavedShot = (value: unknown): value is SavedShot => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedShot>;
  return (
    item.version === 3 &&
    typeof item.id === "string" &&
    typeof item.project === "string" &&
    typeof item.scene === "string" &&
    typeof item.shot === "string" &&
    Boolean(item.snapshot) &&
    Boolean(item.result)
  );
};

export function loadShots(): SavedShot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedShot).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export const persistShots = (shots: SavedShot[]) => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(shots.slice(0, MAX_RECORDS)),
  );
};

export function saveShot(record: SavedShot) {
  const existing = loadShots().filter((item) => item.id !== record.id);
  const next = [record, ...existing].slice(0, MAX_RECORDS);
  persistShots(next);
  return next;
}

export function removeShot(id: string) {
  const next = loadShots().filter((item) => item.id !== id);
  persistShots(next);
  return next;
}

export function importShots(text: string) {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("导入文件不是镜次记录列表。");
  const valid = parsed.filter(isSavedShot);
  if (!valid.length) throw new Error("导入文件中没有可用的 V3 镜次记录。");
  const current = loadShots();
  const merged = [...valid, ...current].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.id === item.id) === index,
  );
  persistShots(merged);
  return merged.slice(0, MAX_RECORDS);
}

export const newShotId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `shot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
