import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOOD_TABLES, LEGACY_FOOD_TABLE_ID } from "../src/data/foodTable";
import { normalizeMenu } from "../src/lib/storage/menus";
import { FOODS_PATH } from "./helpers/foods";

describe("成分表の版", () => {
  it("現行の版のデータファイルが public/ にあり、食品番号が重複していない", () => {
    const path = FOODS_PATH;
    expect(existsSync(path)).toBe(true);
    const foods = JSON.parse(readFileSync(path, "utf8")) as { code: string }[];
    expect(foods.length).toBeGreaterThan(0);
    expect(new Set(foods.map((f) => f.code)).size).toBe(foods.length);
  });

  it("版の記録が無い旧い献立は八訂（増補2023）として読む", () => {
    expect(LEGACY_FOOD_TABLE_ID in FOOD_TABLES).toBe(true);
    const legacy = normalizeMenu({ id: "m1", title: "t", rows: [{ code: "01088", usedWeight: "150" }] });
    expect(legacy.foodTable).toBe(LEGACY_FOOD_TABLE_ID);
  });

  it("記録済みの版はそのまま保つ（まだアプリが知らない版でも書き換えない）", () => {
    expect(normalizeMenu({ id: "m2", foodTable: "2023_増補", rows: [] }).foodTable).toBe("2023_増補");
    expect(normalizeMenu({ id: "m3", foodTable: "九訂", rows: [] }).foodTable).toBe("九訂");
  });
});
