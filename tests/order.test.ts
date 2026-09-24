import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { orderLine, parseServings } from "../src/core/order";
import { CURRENT_FOOD_TABLE } from "../src/data/foodTable";
import { Food, findByCode } from "../src/data/foods";
import { normalizeMenu } from "../src/lib/storage/menus";

const foods = JSON.parse(readFileSync(resolve(__dirname, "../public", CURRENT_FOOD_TABLE.file), "utf8")) as Food[];
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
