import { describe, expect, it } from "vitest";
import { dishLabel, ingredientMatches, inferDishes } from "../src/core/dishName";
import { DISH_CATALOG } from "../src/data/dishCatalog";
import { findByCode } from "../src/data/foods";
import { loadTestFoods } from "./helpers/foods";

const foods = loadTestFoods();
const food = (code: string) => {
  const f = findByCode(foods, code);
  if (!f) throw new Error(`食品番号 ${code} が成分表にありません`);
  return f;
};
const names = (codes: string[]) => inferDishes(codes.map(food), DISH_CATALOG).map((m) => m.dish.name);

describe("料理データ", () => {
  it("代表の食品番号は実在し、その材料の語に当たる", () => {
    const bad = DISH_CATALOG.flatMap((d) =>
      d.ingredients.filter((i) => !findByCode(foods, i.code) || !ingredientMatches(food(i.code), i)).map((i) => `${d.name}: ${i.code}`),
    );
    expect(bad).toEqual([]);
  });

  it("どの料理も、自分の材料を入れればその料理名になる（ほかの料理と取り違えない）", () => {
    const wrong = DISH_CATALOG.filter((d) => names(d.ingredients.map((i) => i.code))[0] !== d.name).map((d) => d.name);
    expect(wrong).toEqual([]);
  });
});

describe("献立名の推定", () => {
  const ご飯 = "01088";
  const 肉じゃが = ["11034", "02017", "06153", "06214", "17007", "03003"];
  const みそ汁 = ["04032", "09041", "17045"];

  it("ご飯・肉じゃが・みそ汁の献立は「肉じゃが他」", () => {
    const rows = [ご飯, ...肉じゃが, ...みそ汁].map(food);
    const found = inferDishes(rows, DISH_CATALOG);
    expect(found.map((m) => m.dish.name)).toEqual(["肉じゃが", "みそ汁"]);
    expect(dishLabel(found[0], rows)).toBe("肉じゃが他");
  });

  it("その料理だけなら「他」を付けない", () => {
    const rows = 肉じゃが.map(food);
    expect(dishLabel(inferDishes(rows, DISH_CATALOG)[0], rows)).toBe("肉じゃが");
  });

  it("主な材料が揃わなければ推定しない", () => {
    expect(names(["02017", "06153"])).toEqual([]); // じゃがいも・たまねぎだけ
    expect(names([ご飯, "12004"])).toEqual([]); // ご飯と卵
  });

  it("材料が多く当たる料理を選ぶ（豚肉・だいこん・みその汁物はみそ汁より豚汁）", () => {
    expect(names(["11123", "06134", "06214", "17045"])).toEqual(["豚汁"]);
  });
});
