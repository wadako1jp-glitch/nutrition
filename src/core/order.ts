// 発注量の計算（Reactに依存しない純粋関数）。
// 使用量は「実際に料理で使う可食部の重さ」（栄養計算にはこれをそのまま使う）。発注量はそこから
// 成分表の廃棄率で割り戻した「買う量」で、栄養計算には使わない。何を切り捨てた量なのかは廃棄部位で示す。
import { Food, cellValue } from "../data/foods";
import { purchaseWeight, round1 } from "./nutrition";

// 選んだ食品が調理後・加工後の形のとき、実際に買う形での発注量（成分表の備考に換算値があるものだけ）
export interface PurchaseForm {
  label: string; // 買う形 例: 「精白米」「しょうが 根茎 皮なし 生」
  perPerson: number; // g/人
  total: number; // g/人数分
  basis: string; // 根拠（成分表の備考のどの値を使ったか）
}

export interface OrderLine {
  wastePct: number; // 廃棄率(%)。成分表が空欄のときは0として扱う
  wastePart: string | null; // 廃棄部位（成分表の備考）。廃棄率0や記載なしは null
  usedPerPerson: number; // 使用量(g/人) = 可食部
  orderPerPerson: number; // 発注量(g/人)
  usedTotal: number; // 使用量(g) × 人数
  orderTotal: number; // 発注量(g) × 人数
  discardTotal: number; // 捨てる分(g) = 発注量 − 使用量（人数分）
  purchase: PurchaseForm | null; // 買う形での発注量（めし→米、おろし→おろす前）
  caution: string | null; // 調理後の重さのため発注量がそのまま買う量にならない食品への注意
  peelAlt: { label: string; wastePct: number } | null; // 皮つき⇔皮なしの対になる食品の廃棄率（選び間違いに気づけるように）
  // 画面の「発注量」列に出す値。買う形に換算できる食品は換算後、それ以外は orderTotal / orderPerPerson と同じ
  buyTotal: number;
  buyPerPerson: number;
  // 買ったうち料理に使わない分。おろしは「おろし汁・皮」も含む。めし（炊くと重くなる）は null
  buyDiscardTotal: number | null;
}

// 食品名の最後の語が調理後の状態を表すもの。発注量は「その状態の重さ」になり、買う量とは違う。
// 重量変化の倍率は成分表の備考に無く「調理による重量変化率表」が必要なため、換算はせず注意だけ出す。
const COOKED_STATES = [
  "ゆで",
  "水煮",
  "焼き",
  "蒸し",
  "油いため",
  "ソテー",
  "素揚げ",
  "天ぷら",
  "フライ",
  "電子レンジ調理",
  "水戻し",
  "塩抜き",
];

function nameWords(food: Food): string[] {
  return food.name.split("　").filter(Boolean);
}

export function cookedCaution(food: Food): string | null {
  if (food.raw_equiv || food.grated) return null; // 換算できるものは purchase で示す
  const state = nameWords(food).find((w) => COOKED_STATES.includes(w.trim()));
  if (!state) return null;
  return `「${state.trim()}」後の重さです。乾物や生で買うなら、買う形の食品を選び直してください（調理による重量変化は計算しません）`;
}

function purchaseForm(food: Food, usedPerPerson: number, servings: number): PurchaseForm | null {
  if (food.raw_equiv) {
    const { label, g_per_100g } = food.raw_equiv;
    return {
      label: label.replace(/　/g, " "),
      perPerson: round1((usedPerPerson * g_per_100g) / 100),
      total: round1((usedPerPerson * servings * g_per_100g) / 100),
      basis: `成分表の備考「${label.replace(/　/g, "")}${g_per_100g} g相当量を含む」（100gあたり）`,
    };
  }
  if (food.grated) {
    const { ratio_pct, source_name, source_waste_pct } = food.grated;
    const srcWaste = cellValue(source_waste_pct) ?? 0;
    const before = (w: number) => (w * 100) / ratio_pct; // おろす前（可食部）の重さ
    return {
      label: source_name
        .split("　")
        .filter((w) => !/^[（＜［]/.test(w))
        .join(" "),
      perPerson: purchaseWeight(before(usedPerPerson), srcWaste),
      total: purchaseWeight(before(usedPerPerson * servings), srcWaste),
      basis: `成分表の備考「全体に対する割合${ratio_pct}%」と、おろす前の食品の廃棄率${srcWaste}%`,
    };
  }
  return null;
}

// 発注量 = 使用量 ÷ (1 − 廃棄率/100)。人数分は「使用量×人数」を割り戻してから小数第1位で丸める
// （1人分を丸めてから人数倍すると、人数が多いほど丸めの誤差が膨らむため）。
export function orderLine(food: Food, usedPerPerson: number, servings: number): OrderLine {
  const wastePct = cellValue(food.waste_pct) ?? 0;
  const usedTotal = round1(usedPerPerson * servings);
  const orderTotal = purchaseWeight(usedPerPerson * servings, wastePct);
  const altWaste = food.peel_alt ? cellValue(food.peel_alt.waste_pct) : null;
  const purchase = purchaseForm(food, usedPerPerson, servings);
  const discardTotal = round1(orderTotal - usedTotal);
  return {
    wastePct,
    wastePart: wastePct > 0 ? (food.waste_part ?? null) : null,
    usedPerPerson: round1(usedPerPerson),
    orderPerPerson: purchaseWeight(usedPerPerson, wastePct),
    usedTotal,
    orderTotal,
    discardTotal,
    purchase,
    caution: cookedCaution(food),
    peelAlt: food.peel_alt && altWaste !== null ? { label: food.peel_alt.label, wastePct: altWaste } : null,
    buyTotal: purchase ? purchase.total : orderTotal,
    buyPerPerson: purchase ? purchase.perPerson : purchaseWeight(usedPerPerson, wastePct),
    buyDiscardTotal: !purchase ? discardTotal : food.grated ? round1(purchase.total - usedTotal) : null,
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
