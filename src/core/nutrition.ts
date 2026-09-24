// 栄養計算のコアロジック。Reactに依存しない純粋関数だけを置く。
// 丸め・小計のルールは CLAUDE.md「計算ルール」参照:
//   - 丸めは小数第1位
//   - 小計は「行ごとに小数第1位で丸めてから合計」（手計算と同じ順序）
import { Food, cellValue } from "../data/foods";

export const NUTRIENT_KEYS = [
  "kcal",
  "protein_g",
  "fat_g",
  "carb_g",
  "fiber_g",
  "ca_mg",
  "fe_mg",
  "va_ugRAE",
  "vd_ug",
  "vb1_mg",
  "vb2_mg",
  "vc_mg",
  "salt_g",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

// 用紙の列見出し [名称, 単位]（CLAUDE.md「UI・入力体験の要件」参照）
export const NUTRIENT_LABELS: Record<NutrientKey, [string, string]> = {
  kcal: ["エネルギー", "kcal"],
  protein_g: ["蛋白質", "g"],
  fat_g: ["脂質", "g"],
  carb_g: ["炭水化物", "g"],
  fiber_g: ["食物繊維", "g"],
  ca_mg: ["カルシウム", "mg"],
  fe_mg: ["鉄", "mg"],
  va_ugRAE: ["ビタミンA", "μgRAE"],
  vd_ug: ["ビタミンD", "μg"],
  vb1_mg: ["ビタミンB1", "mg"],
  vb2_mg: ["ビタミンB2", "mg"],
  vc_mg: ["ビタミンC", "mg"],
  salt_g: ["食塩相当量", "g"],
};

export type NutrientRow = Record<NutrientKey, number>;

// 小数第1位で丸める（アプリ全体でこの関数だけを使う。用紙と同じ丸めルール）
export function round1(x: number): number {
  return Math.round(x * 10 + (x >= 0 ? 1e-9 : -1e-9)) / 10;
}

// 食品解決パイプラインの最終ステップ:
// (食品, 栄養計算重量) -> 各栄養素の値（100gあたりの成分値 × 重量 / 100、丸め済み）
export function computeRow(food: Food, calcWeightG: number): NutrientRow {
  const row = {} as NutrientRow;
  for (const key of NUTRIENT_KEYS) {
    const per100 = cellValue(food[key]);
    const value = per100 === null ? 0 : (per100 * calcWeightG) / 100;
    row[key] = round1(value);
  }
  return row;
}

// 小計 = 行ごとに丸めた値の合計（合計してから丸めるのは不可。用紙の手計算と同じ順序）
export function sumRows(rows: NutrientRow[]): NutrientRow {
  const sum = {} as NutrientRow;
  for (const key of NUTRIENT_KEYS) {
    sum[key] = round1(rows.reduce((acc, r) => acc + r[key], 0));
  }
  return sum;
}

// 廃棄率ルール: 仕入れ量（発注量） = 使用量 ÷ (1 − 廃棄率)。発注量表示（src/core/order.ts）で使う
export function purchaseWeight(usedWeightG: number, wastePct: number): number {
  if (!wastePct) return round1(usedWeightG);
  return round1(usedWeightG / (1 - wastePct / 100));
}
