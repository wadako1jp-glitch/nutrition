// 発注量の計算（Reactに依存しない純粋関数）。
// 使用量は「実際に料理で使う可食部の重さ」（栄養計算にはこれをそのまま使う）。発注量はそこから
// 成分表の廃棄率で割り戻した「買う量」で、栄養計算には使わない。何を切り捨てた量なのかは廃棄部位で示す。
import { Food, cellValue } from "../data/foods";
import { purchaseWeight, round1 } from "./nutrition";

export interface OrderLine {
  wastePct: number; // 廃棄率(%)。成分表が空欄のときは0として扱う
  wastePart: string | null; // 廃棄部位（成分表の備考）。廃棄率0や記載なしは null
  usedPerPerson: number; // 使用量(g/人) = 可食部
  orderPerPerson: number; // 発注量(g/人)
  usedTotal: number; // 使用量(g) × 人数
  orderTotal: number; // 発注量(g) × 人数
  discardTotal: number; // 捨てる分(g) = 発注量 − 使用量（人数分）
}

// 発注量 = 使用量 ÷ (1 − 廃棄率/100)。人数分は「使用量×人数」を割り戻してから小数第1位で丸める
// （1人分を丸めてから人数倍すると、人数が多いほど丸めの誤差が膨らむため）。
export function orderLine(food: Food, usedPerPerson: number, servings: number): OrderLine {
  const wastePct = cellValue(food.waste_pct) ?? 0;
  const usedTotal = round1(usedPerPerson * servings);
  const orderTotal = purchaseWeight(usedPerPerson * servings, wastePct);
  return {
    wastePct,
    wastePart: wastePct > 0 ? (food.waste_part ?? null) : null,
    usedPerPerson: round1(usedPerPerson),
    orderPerPerson: purchaseWeight(usedPerPerson, wastePct),
    usedTotal,
    orderTotal,
    discardTotal: round1(orderTotal - usedTotal),
  };
}

// 人数の入力。1以上の整数だけを受け付け、それ以外は null（呼び出し側で直前の値を保つ）
export const MAX_SERVINGS = 9999;
export function parseServings(raw: string): number | null {
  const s = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1 && n <= MAX_SERVINGS ? n : null;
}
