// テストで使う成分表。ふだんは今の版（src/data/foodTable.ts の CURRENT_FOOD_TABLE）を読む。
// 環境変数 FOODS_JSON に foods.json のパスを渡すと、その表でテストを回せる
// （新しい版の候補が今のテストを通るか確かめるため。.github/workflows/watch-food-table.yml が使う）。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CURRENT_FOOD_TABLE } from "../../src/data/foodTable";
import type { Food } from "../../src/data/foods";

export const FOODS_PATH = process.env.FOODS_JSON
  ? resolve(process.env.FOODS_JSON)
  : resolve(__dirname, "../../public", CURRENT_FOOD_TABLE.file);

export function loadTestFoods(): Food[] {
  return JSON.parse(readFileSync(FOODS_PATH, "utf8")) as Food[];
}
