// 料理タグ（主食・主菜など）の純粋ロジック。材料行への単一タグ付けとして扱う。
// Reactに依存しない（CLAUDE.md「src/core/」の方針）。
// タグは専用の管理UIを持たず、プルダウンで選んだ時点で作られ、どの材料にも使われなくなったら消える。

export interface Dish {
  id: string;
  name: string;
  order: number;
}

export const DISH_PRESETS = ["主食", "主菜", "副菜", "副菜2", "汁物", "デザート"] as const;

export function createDishId(): string {
  return `dish_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export type EnsureDishResult = { ok: true; dishes: Dish[]; id: string } | { ok: false; error: string };

// 名前でタグを引き、無ければ作る（同一献立内でタグ名は一意。前後の空白は無視）。
// 並び順: プリセットは定義順で固定、自由入力のタグはその後ろに作った順。
export function ensureDish(dishes: Dish[], rawName: string, id: string = createDishId()): EnsureDishResult {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "タグ名を入力してください" };
  const existing = dishes.find((d) => d.name === name);
  if (existing) return { ok: true, dishes, id: existing.id };
  const presetIndex = (DISH_PRESETS as readonly string[]).indexOf(name);
  const order = presetIndex >= 0 ? presetIndex : Math.max(DISH_PRESETS.length - 1, ...dishes.map((d) => d.order)) + 1;
  return { ok: true, dishes: [...dishes, { id, name, order }], id };
}

// どの材料にも付いていないタグを取り除く
export function pruneUnusedDishes(dishes: Dish[], rows: { dishId: string | null }[]): Dish[] {
  const used = new Set(rows.map((r) => r.dishId));
  const next = dishes.filter((d) => used.has(d.id));
  return next.length === dishes.length ? dishes : next;
}

export function sortedDishes(dishes: Dish[]): Dish[] {
  return [...dishes].sort((a, b) => a.order - b.order);
}

// プルダウンに出すタグ名：プリセット＋この献立で作った自由入力タグ
export function dishOptionNames(dishes: Dish[]): string[] {
  const custom = sortedDishes(dishes)
    .map((d) => d.name)
    .filter((n) => !(DISH_PRESETS as readonly string[]).includes(n));
  return [...DISH_PRESETS, ...custom];
}

export interface RowGroup<R> {
  dish: Dish | null; // null = 未割当
  rows: { row: R; index: number }[]; // index = 元の配列での位置（登録順）
}

// 表示順: タグ順（order）→ タグ内は登録順。未割当は末尾にまとめる。
// 材料の無いタグ・未割当はグループを作らない。
export function groupRowsByDish<R extends { dishId: string | null }>(rows: R[], dishes: Dish[]): RowGroup<R>[] {
  const groups: RowGroup<R>[] = [];
  for (const dish of sortedDishes(dishes)) {
    const members = rows.map((row, index) => ({ row, index })).filter((x) => x.row.dishId === dish.id);
    if (members.length) groups.push({ dish, rows: members });
  }
  const known = new Set(dishes.map((d) => d.id));
  const unassigned = rows.map((row, index) => ({ row, index })).filter((x) => x.row.dishId === null || !known.has(x.row.dishId));
  if (unassigned.length) groups.push({ dish: null, rows: unassigned });
  return groups;
}

// タグごとの淡い背景色（彩度を抑えた、既存の生成り系テーマに馴染む色）。
// order で決めるので、他のタグを足し引きしても色は変わらない（主食はいつも同じ色）。
const DISH_TINTS = ["#f7ecc8", "#dfecd6", "#d9e6f2", "#f3dcdc", "#e6e0f0", "#d8ece8", "#f4e3d2", "#e8e8d6"];

export function dishTint(dishes: Dish[], dishId: string | null): string | undefined {
  if (dishId === null) return undefined;
  const dish = dishes.find((d) => d.id === dishId);
  return dish ? DISH_TINTS[dish.order % DISH_TINTS.length] : undefined;
}
