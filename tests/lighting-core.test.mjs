import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLighting,
  incidentLuxForExposure,
  outputFractionAtSetting,
  recommendCct,
  settingForOutputFraction,
  shutterSpeedFromAngle,
} from "../app/lighting-core.ts";

const fixture = {
  brand: "测试品牌",
  model: "测试灯",
  form: "COB聚光灯",
  kind: "双色温(Bi)",
  watts: "100",
  lux: 10000,
  referenceM: 1,
  luxNote: "10,000@1m",
  cct: "2700-6500",
  cri: "95",
  tlci: "95",
  mount: "保荣口",
  positioning: "测试",
  id: "test-light",
  wattage: 100,
  referenceLux: 10000,
  cctMin: 2700,
  cctMax: 6500,
  dataConfidence: "official",
  dataLabel: "官方资料",
  sourceUrl: "https://example.com",
  testedCct: 5600,
  testedModifier: "裸灯",
  photometricsByCct: [],
  linearCurveDocumented: true,
};

test("uses the Sekonic lumisphere incident-light relationship", () => {
  const lux = incidentLuxForExposure({
    iso: 800,
    aperture: 2.8,
    shutterSpeed: 48,
    compensationStops: 0,
  });
  assert.ok(Math.abs(lux - 159.936) < 0.001);
  assert.equal(shutterSpeedFromAngle(24, 180), 48);
});

test("supports linear and fixture-calibrated dimming", () => {
  assert.equal(outputFractionAtSetting(25, "linear", []), 0.25);
  const calibration = [
    { setting: 25, output: 15 },
    { setting: 50, output: 42 },
    { setting: 75, output: 70 },
  ];
  assert.equal(outputFractionAtSetting(25, "calibrated", calibration), 0.15);
  assert.ok(
    Math.abs(settingForOutputFraction(0.42, "calibrated", calibration) - 50) <
      0.001,
  );
  assert.equal(settingForOutputFraction(1.25, "linear", []), 125);
});

test("returns exact power, range and color-temperature instructions", () => {
  const result = calculateLighting({
    fixture,
    iso: 800,
    aperture: 2.8,
    fps: 24,
    shutterAngle: 180,
    ndStops: 0,
    exposureCompensationStops: 0,
    faceCorrectionStops: 0,
    environmentCorrectionStops: 1,
    ambientLux: 50,
    ambientCct: 5600,
    targetCct: 4300,
    distance: 2,
    lampHeight: 2,
    subjectHeight: 1.63,
    lightCount: 1,
    modifierLossStops: 0.5,
    currentPower: 50,
    curveMode: "linear",
    calibration: [],
    meterLux: null,
  });
  assert.equal(result.status, "ready");
  assert.ok(result.suggestedPower > 0 && result.suggestedPower < 100);
  assert.ok(result.powerRange[0] < result.powerRange[1]);
  assert.equal(result.environmentTargetLux, 100);
  assert.equal(result.environmentFillLux, 50);
  assert.ok(result.environmentSuggestedPower > 0);
  assert.ok(result.cct.lampCct >= 2700 && result.cct.lampCct <= 6500);
});

test("recommends correction gel for a fixed-CCT fixture", () => {
  const fixed = { ...fixture, cctMin: 5600, cctMax: 5600 };
  const result = recommendCct({
    fixture: fixed,
    targetCct: 3200,
    ambientCct: 3200,
    ambientLux: 0,
    keyLux: 200,
  });
  assert.equal(result.lampCct, 5600);
  assert.match(result.gel, /CTO/);
  assert.ok(result.gelLossStops > 0);
});

test("reports an underpowered lamp instead of silently clamping to 100%", () => {
  const result = calculateLighting({
    fixture: { ...fixture, referenceLux: 100 },
    iso: 400,
    aperture: 8,
    fps: 60,
    shutterAngle: 90,
    ndStops: 2,
    exposureCompensationStops: 0,
    faceCorrectionStops: 0,
    environmentCorrectionStops: 0,
    ambientLux: 0,
    ambientCct: 5600,
    targetCct: 5600,
    distance: 4,
    lampHeight: 2,
    subjectHeight: 1.63,
    lightCount: 1,
    modifierLossStops: 1,
    currentPower: 100,
    curveMode: "linear",
    calibration: [],
    meterLux: null,
  });
  assert.equal(result.status, "underpowered");
  assert.ok(result.suggestedPower > 100);
});

test("treats manual meter calibration as a 1m reading", () => {
  const baseInput = {
    fixture: { ...fixture, referenceM: 3, referenceLux: 9000 },
    iso: 800,
    aperture: 2.8,
    fps: 24,
    shutterAngle: 180,
    ndStops: 0,
    exposureCompensationStops: 0,
    faceCorrectionStops: 0,
    environmentCorrectionStops: 0,
    ambientLux: 0,
    ambientCct: 5600,
    targetCct: 5600,
    distance: 1,
    lampHeight: 1.63,
    subjectHeight: 1.63,
    lightCount: 1,
    modifierLossStops: 0,
    currentPower: 100,
    curveMode: "linear",
    calibration: [],
  };
  const measured = calculateLighting({ ...baseInput, meterLux: 1000 });
  assert.equal(Math.round(measured.fullKeyLux), 1000);
});
