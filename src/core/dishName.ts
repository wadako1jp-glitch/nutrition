// 材料から料理名を推定する（献立名の自動付け）。料理データ（src/data/dishCatalog.ts）と材料を見比べるだけで、
// 通信もAIも使わない（オフラインで一瞬で動き、結果は毎回同じ）。設計は docs/design/recipes-and-dish-names.md。
//
// 判定: 料理の「主な材料」がすべて入っていて、料理全体の重みの半分以上が入っていれば、その料理とみなす。
// 1つの献立に料理が複数あるので、重みの大きく当たった料理から順に材料を割り当てていく（調味料は共有してよい）。
import type { Food } from "../data/foods";
import { normalizeKana } from "../data/foods";

export type DishCategory = "主菜" | "主食" | "副菜" | "汁物";
export type IngredientRole = "main" | "sub" | "seasoning";

export interface CatalogIngredient {
  // 食品名の語。どれか1つに当たればよい（例: 肉じゃがの肉は ["うし", "ぶた"]）。
  // 食品名の語と同じか、その語で終わるものに当たる（「しょうゆ」は「こいくちしょうゆ」にも当たる）
  words: string[];
  role: IngredientRole;
  code: string; // 取り込むときに使う代表の食品番号
  g: number; // 1人分の目安(g)
}

export interface CatalogDish {
  name: string;
  category: DishCategory;
  ingredients: CatalogIngredient[];
}

export interface DishMatch {
  dish: CatalogDish;
  rowIndexes: number[]; // この料理の材料として使った行（調味料を除く）
  weight: number; // 当たった材料の重みの合計
}

const ROLE_WEIGHT: Record<IngredientRole, number> = { main: 3, sub: 1, seasoning: 0.5 };
const MIN_RATIO = 0.5;
const CATEGORY_ORDER: DishCategory[] = ["主菜", "主食", "副菜", "汁物"];
const categoryRank = (m: DishMatch) => CATEGORY_ORDER.indexOf(m.dish.category);

// 食品名を語に分ける（分類の括弧の中身も1語として残す。「ぶた ［ひき肉］ 生」→ ぶた・ひき肉・生）
export function nameWords(food: Food): string[] {
  return food.name
    .replace(/[＜＞（）［］]/g, " ")
    .split(/[\s　]+/)
    .map(normalizeKana)
    .filter(Boolean);
}

// 食品がその材料に当たるか（料理データの確認用にも使う）
export function ingredientMatches(food: Food, ingredient: CatalogIngredient): boolean {
  return hits(nameWords(food), ingredient);
}

function hits(words: string[], ingredient: CatalogIngredient): boolean {
  return ingredient.words.some((w) => {
    const key = normalizeKana(w);
    return words.some((x) => x === key || x.endsWith(key));
  });
}

// 調味料・油・砂糖・酒類（「他」を付けるかの判断で、料理の材料に数えない）
function isSeasoning(food: Food): boolean {
  return /^(03|14|16|17)/.test(food.code);
}

function matchDish(dish: CatalogDish, rows: { words: string[]; seasoning: boolean }[], used: Set<number>): DishMatch | null {
  let weight = 0;
  let total = 0;
  const rowIndexes: number[] = [];
  for (const ing of dish.ingredients) {
    total += ROLE_WEIGHT[ing.role];
    // 調味料はほかの料理と共有してよい。それ以外は、まだどの料理にも使っていない行から探す
    const i = rows.findIndex((r, idx) => (ing.role === "seasoning" || !used.has(idx)) && !rowIndexes.includes(idx) && hits(r.words, ing));
    if (i < 0) {
      if (ing.role === "main") return null;
      continue;
    }
    weight += ROLE_WEIGHT[ing.role];
    if (!rows[i].seasoning) rowIndexes.push(i);
  }
  return weight / total >= MIN_RATIO ? { dish, rowIndexes, weight } : null;
}

// 献立に入っている料理を推定する。先頭が献立名に使う料理（主菜＞主食＞副菜＞汁物の順）
export function inferDishes(foods: Food[], catalog: CatalogDish[]): DishMatch[] {
  const rows = foods.map((f) => ({ words: nameWords(f), seasoning: isSeasoning(f) }));
  const used = new Set<number>();
  const found: DishMatch[] = [];
  for (;;) {
    const best = catalog
      .filter((d) => !found.some((m) => m.dish === d))
      .map((d) => matchDish(d, rows, used))
      .filter((m): m is DishMatch => m !== null && m.rowIndexes.length > 0)
      .sort((a, b) => b.weight - a.weight || categoryRank(a) - categoryRank(b))[0];
    if (!best) break;
    found.push(best);
    best.rowIndexes.forEach((i) => used.add(i));
  }
  return found.sort((a, b) => categoryRank(a) - categoryRank(b) || b.weight - a.weight);
}

// 献立名に使う名前。その料理の材料以外（調味料を除く）が献立にあれば「他」を付ける（例: 肉じゃが他）
export function dishLabel(match: DishMatch, foods: Food[]): string {
  const others = foods.some((f, i) => !isSeasoning(f) && !match.rowIndexes.includes(i));
  return others ? `${match.dish.name}他` : match.dish.name;
}
