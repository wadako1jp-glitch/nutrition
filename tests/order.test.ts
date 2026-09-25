import { describe, expect, it } from "vitest";
import { orderLine, parseServings } from "../src/core/order";
import { findByCode } from "../src/data/foods";
import { normalizeMenu } from "../src/lib/storage/menus";
import { loadTestFoods } from "./helpers/foods";

const foods = loadTestFoods();
const food = (code: string) => findByCode(foods, code)!;

describe("発注量", () => {
  it("使用量（可食部）を廃棄率で割り戻し、何を切り捨てるかを成分表の備考から示す", () => {
    const cabbage = orderLine(food("06061"), 50, 1); // キャベツ 廃棄率15% しん
    expect(cabbage).toMatchObject({ wastePct: 15, wastePart: "しん", usedPerPerson: 50, orderPerPerson: 58.8 });
    expect(orderLine(food("06214"), 20, 1).wastePart).toBe("根端、葉柄基部及び皮"); // にんじん
    expect(orderLine(food("12004"), 50, 1).wastePart).toBe("卵殻（付着卵白を含む）"); // 鶏卵
  });

  it("人数分は使用量×人数を割り戻してから丸め、捨てる分も出す", () => {
    const l = orderLine(food("06061"), 50, 40);
    expect(l.usedTotal).toBe(2000);
    expect(l.orderTotal).toBe(2352.9); // 2000 ÷ 0.85（1人分58.8×40=2352 とはしない）
    expect(l.discardTotal).toBe(352.9);
  });

  it("廃棄率0の食品は発注量＝使用量で、廃棄部位は出さない", () => {
    expect(orderLine(food("01088"), 150, 3)).toMatchObject({ wastePct: 0, wastePart: null, orderTotal: 450, discardTotal: 0 });
  });

  it("廃棄率がある食品は、ほぼすべて廃棄部位が分かる（記載のない数品目を除く）", () => {
    const withWaste = foods.filter((f) => typeof f.waste_pct === "number" && f.waste_pct > 0);
    const missing = withWaste.filter((f) => !f.waste_part);
    expect(withWaste.length).toBeGreaterThan(500);
    expect(missing.length).toBeLessThanOrEqual(10);
  });

  it("めしは炊く前の米で発注量を出す（備考「精白米47 g相当量を含む」）", () => {
    const l = orderLine(food("01088"), 150, 40);
    expect(l.orderTotal).toBe(6000); // めしの重さ（参考）
    expect(l.purchase).toMatchObject({ label: "精白米", perPerson: 70.5, total: 2820 });
    expect(orderLine(food("01154"), 100, 10).purchase).toMatchObject({ label: "精白米", total: 550 }); // もち米 55g
    expect(orderLine(food("01170"), 100, 1).purchase?.label).toBe("おおむぎ 押麦 乾"); // 押麦めし「乾35 g」
    // 画面の発注量列・合計は買う形（精白米）の量。炊くと重くなるので「使わない分」は出さない
    expect(l).toMatchObject({ buyTotal: 2820, buyPerPerson: 70.5, buyDiscardTotal: null });
    // 備考に換算値があるめし・かゆは全件（25品目）換算できる
    expect(foods.filter((f) => f.raw_equiv).length).toBe(25);
  });

  it("おろしはおろす前の食品で発注量を出す（備考「全体に対する割合」＋元の食品の廃棄率）", () => {
    // しょうが: おろし 3g/人 → 皮なし生 12.5g → 皮むき廃棄20% → 15.6g/人、40人で625g
    expect(orderLine(food("06365"), 3, 40).purchase).toMatchObject({ label: "しょうが 根茎 皮なし 生", perPerson: 15.6, total: 625 });
    // 買った625gのうち料理に使うのは120g（おろし汁・皮を含めて505gは使わない）
    expect(orderLine(food("06365"), 3, 40)).toMatchObject({ buyTotal: 625, buyPerPerson: 15.6, buyDiscardTotal: 505 });
    // だいこん: おろし 20g/人 → 20 ÷ 0.18 ÷ 0.85
    expect(orderLine(food("06367"), 20, 1).purchase?.perPerson).toBe(130.7);
  });

  it("換算の根拠が無い調理後の食品（ゆで・水煮など）は注意だけ出す", () => {
    expect(orderLine(food("09051"), 30, 1).caution).toContain("「ゆで」後の重さ"); // ひじき ゆで
    expect(orderLine(food("01039"), 200, 1).caution).toContain("ゆで"); // うどん ゆで
    expect(orderLine(food("06061"), 50, 1).caution).toBeNull(); // キャベツ 生
    // 換算しない食品の発注量列は通常どおり
    expect(orderLine(food("06061"), 50, 40)).toMatchObject({ buyTotal: 2352.9, buyPerPerson: 58.8, buyDiscardTotal: 352.9 });
    expect(orderLine(food("01088"), 150, 1).caution).toBeNull(); // めしは換算で示すので注意は出さない
  });

  it("皮つき⇔皮なしの対になる食品の廃棄率を示す（選び間違いに気づけるように）", () => {
    expect(orderLine(food("02063"), 60, 40).peelAlt).toEqual({ label: "皮なし", wastePct: 10 }); // じゃがいも 皮つき
    expect(orderLine(food("06214"), 20, 1).peelAlt).toEqual({ label: "皮つき", wastePct: 3 }); // にんじん 皮なし
    expect(orderLine(food("06061"), 50, 1).peelAlt).toBeNull();
  });

  it("人数は1以上の整数だけ受け付ける（全角数字も可）", () => {
    expect(parseServings("40")).toBe(40);
    expect(parseServings("４０")).toBe(40);
    for (const bad of ["", "0", "-1", "1.5", "a", "10000"]) expect(parseServings(bad)).toBeNull();
  });

  it("人数の記録が無い旧い献立は1人分として読む", () => {
    expect(normalizeMenu({ id: "m", rows: [] }).servings).toBe(1);
    expect(normalizeMenu({ id: "m", rows: [], servings: 40 }).servings).toBe(40);
    expect(normalizeMenu({ id: "m", rows: [], servings: 0 }).servings).toBe(1);
  });
});
