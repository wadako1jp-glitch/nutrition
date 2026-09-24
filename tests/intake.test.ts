import { describe, expect, it } from "vitest";
import { evaluateIntake, resolveReference } from "../src/core/intake";
import { NUTRIENT_KEYS, NutrientRow } from "../src/core/nutrition";
import type { Profile } from "../src/lib/storage/profile";

function row(values: Partial<NutrientRow>): NutrientRow {
  const r = {} as NutrientRow;
  for (const k of NUTRIENT_KEYS) r[k] = values[k] ?? 0;
  return r;
}

const student: Profile = { age: 20, sex: "female", activityLevel: 2, heightCm: null, weightKg: null };

function evalFor(profile: Profile, total: NutrientRow) {
  const ref = resolveReference(profile);
  if (!ref) throw new Error("no reference");
  return Object.fromEntries(evaluateIntake(total, ref).map((e) => [e.key, e]));
}

describe("食事摂取基準（2025年版）の区分引き", () => {
  it("20歳女性・ふつう → 18〜29歳、EER 1950kcal、鉄は月経ありの10.0mg", () => {
    const e = evalFor(student, row({ kcal: 1950, fe_mg: 10 }));
    expect(e.kcal.referenceText).toBe("1,950 kcal");
    expect(e.kcal.percent).toBeCloseTo(100);
    expect(e.fe_mg.indicator).toBe("推奨量（月経あり）");
    expect(e.fe_mg.percent).toBeCloseTo(100);
  });

  it("身体活動レベルを変えるとエネルギーの充足率が変わる", () => {
    const total = row({ kcal: 1950 });
    const low = evalFor({ ...student, activityLevel: 1 }, total).kcal.percent!;
    const high = evalFor({ ...student, activityLevel: 3 }, total).kcal.percent!;
    expect(low).toBeCloseTo((1950 / 1700) * 100);
    expect(high).toBeCloseTo((1950 / 2250) * 100);
  });

  it("策定の無い身体活動レベルは「ふつう」で代用し、その旨を返す", () => {
    const ref = resolveReference({ age: 80, sex: "male", activityLevel: 3, heightCm: null, weightKg: null })!;
    expect(ref.activityFallback).toBe(true);
    expect(ref.activityLevelUsed).toBe(2);
  });

  it("1歳未満は対象外", () => {
    expect(resolveReference({ ...student, age: 0 })).toBeNull();
  });
});

describe("充足率の評価", () => {
  it("食塩相当量が目標量（女性6.5g未満）に達したら警告", () => {
    expect(evalFor(student, row({ salt_g: 6.4 })).salt_g.status).toBe("ok");
    expect(evalFor(student, row({ salt_g: 6.5 })).salt_g.status).toBe("over");
    expect(evalFor(student, row({ salt_g: 9 })).salt_g.status).toBe("over");
  });

  it("脂質・炭水化物は%エネルギーで評価し、脂質の上限超過は警告", () => {
    // 2000kcal のうち 脂質 80g = 720kcal = 36%E（上限30を超過）、炭水化物 250g = 1000kcal = 50%E
    const e = evalFor(student, row({ kcal: 2000, fat_g: 80, carb_g: 250 }));
    expect(e.fat_g.energyPct).toBeCloseTo(36);
    expect(e.fat_g.status).toBe("over");
    expect(e.carb_g.energyPct).toBeCloseTo(50);
    expect(e.carb_g.status).toBe("ok");
    const low = evalFor(student, row({ kcal: 2000, fat_g: 30 }));
    expect(low.fat_g.status).toBe("low"); // 13.5%E
  });

  it("エネルギー0なら%エネルギーは出さない（エラーにしない）", () => {
    const e = evalFor(student, row({}));
    expect(e.fat_g.energyPct).toBeNull();
    expect(e.fat_g.status).toBeNull();
  });

  it("推奨量の80%未満は不足、120%超は多い", () => {
    expect(evalFor(student, row({ vc_mg: 79 })).vc_mg.status).toBe("low");
    expect(evalFor(student, row({ vc_mg: 100 })).vc_mg.status).toBe("ok");
    expect(evalFor(student, row({ vc_mg: 121 })).vc_mg.status).toBe("high");
  });
});
