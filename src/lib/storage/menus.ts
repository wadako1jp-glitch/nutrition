// 献立の保存・一覧・編集・削除。既存の永続化抽象層（src/lib/storage/index.ts）の上に薄く実装する。
// CLAUDE.md「技術スタック」参照。データ本体は食品コード＋使用量のみ持ち、食品名や成分値は
// 読み込み時に成分表（src/data/foods.ts）から都度解決する（成分表の版が変わっても壊れない）。
import { Meal, isMeal, menuTitle } from "../../core/menuTitle";
import { LEGACY_FOOD_TABLE_ID } from "../../data/foodTable";
import { storage } from "./index";
import { askToKeepData } from "./persist";

export interface StoredMenuRow {
  code: string; // 食品番号
  usedWeight: string; // 使用量(g)。正規化済み（半角）の文字列で保存する
  dishId: string | null; // 料理タグ。null = 未割当
}

// 料理タグ（主食・主菜など）。献立と材料の中間階層だが、ネストではなく材料行へのタグ付けで表す。
export interface StoredDish {
  id: string; // 献立内で一意
  name: string; // 献立内で一意
  order: number; // 表示順
}

export interface StoredMenu {
  id: string;
  title: string; // 「yyyymmdd_朝食」形式（menuTitle で生成）。旧版の自由入力の献立名はそのまま残る
  meal: Meal | null; // 食事区分。料理名を推定できないときの献立名に使う。null = 旧版の献立（自由入力の献立名）
  // auto = 材料から推定した料理名に付け替え続ける / fixed = 選んだ名前のまま。項目が無い旧い献立は fixed
  titleMode: "auto" | "fixed";
  // 作成時の成分表の版（src/data/foodTable.ts の id）。食品番号の意味は版ごとに違い得るため、
  // 改訂版への切り替え時に「どの版の番号か」を判別できるよう記録しておく
  foodTable: string;
  servings: number; // 発注量の人数（使用量は1人分として入力する）
  dishes: StoredDish[];
  rows: StoredMenuRow[];
  createdAt: number;
  updatedAt: number;
}

const KEY = "nutritionApp.menus.v1";

// 料理タグ導入前に保存された献立（dishes / dishId が無い）も読めるように補完する。
// キーは据え置き（v1のまま）で、読み込み時に不足フィールドを埋めるだけの後方互換。
export function normalizeMenu(raw: unknown): StoredMenu {
  const m = raw as Partial<StoredMenu> & { rows?: Partial<StoredMenuRow>[] };
  const dishes = Array.isArray(m.dishes) ? m.dishes : [];
  const dishIds = new Set(dishes.map((d) => d.id));
  const meal = isMeal(m.meal) ? m.meal : null;
  const createdAt = m.createdAt ?? Date.now();
  // 自動の献立名ができる前の献立は、これまでどおり「作成日_区分」を献立名として固定で扱う
  const legacyMealTitle = m.titleMode === undefined && meal !== null;
  return {
    id: String(m.id),
    title: legacyMealTitle ? menuTitle(createdAt, meal) : (m.title ?? ""),
    meal,
    titleMode: m.titleMode === "auto" ? "auto" : "fixed",
    foodTable: typeof m.foodTable === "string" && m.foodTable ? m.foodTable : LEGACY_FOOD_TABLE_ID,
    servings: typeof m.servings === "number" && Number.isInteger(m.servings) && m.servings >= 1 ? m.servings : 1,
    dishes,
    rows: (Array.isArray(m.rows) ? m.rows : []).map((r) => ({
      code: String(r.code),
      usedWeight: r.usedWeight ?? "",
      dishId: r.dishId && dishIds.has(r.dishId) ? r.dishId : null,
    })),
    createdAt,
    updatedAt: m.updatedAt ?? Date.now(),
  };
}

function toMenus(list: unknown[] | null): StoredMenu[] {
  return Array.isArray(list) ? list.map(normalizeMenu) : [];
}

async function readAll(): Promise<StoredMenu[]> {
  return toMenus(await storage.get<unknown[]>(KEY));
}

// 一覧表示用。更新が新しい順。
export async function listMenus(): Promise<StoredMenu[]> {
  const all = await readAll();
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getMenu(id: string): Promise<StoredMenu | undefined> {
  const all = await readAll();
  return all.find((m) => m.id === id);
}

export async function upsertMenu(menu: StoredMenu): Promise<void> {
  await storage.update<unknown[]>(KEY, (list) => {
    const all = toMenus(list);
    return all.some((m) => m.id === menu.id) ? all.map((m) => (m.id === menu.id ? menu : m)) : [...all, menu];
  });
  askToKeepData();
}

export async function deleteMenu(id: string): Promise<void> {
  await storage.update<unknown[]>(KEY, (list) => toMenus(list).filter((m) => m.id !== id));
}

export function createMenuId(): string {
  return `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
