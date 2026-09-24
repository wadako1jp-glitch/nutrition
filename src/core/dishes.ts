// 料理タグ（主食・主菜など）の純粋ロジック。材料行への単一タグ付けとして扱う。
// Reactに依存しない（CLAUDE.md「src/core/」の方針）。

export interface Dish {
  id: string;
  name: string;
  order: number;
}

export const DISH_PRESETS = ["主食", "主菜", "副菜", "副菜2", "汁物", "デザート"] as const;

export type AddDishResult = { ok: true; dishes: Dish[]; dish: Dish } | { ok: false; error: string };

export function createDishId(): string {
  return `dish_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// 同一献立内でタグ名は一意（前後の空白は無視して比較する）
export function addDish(dishes: Dish[], rawName: string, id: string = createDishId()): AddDishResult {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "タグ名を入力してください" };
  if (dishes.some((d) => d.name === name)) return { ok: false, error: `「${name}」は既にあります` };
  const order = dishes.reduce((max, d) => Math.max(max, d.order), -1) + 1;
  const dish = { id, name, order };
  return { ok: true, dishes: [...dishes, dish], dish };
}

// タグを削除しても材料は消さず、そのタグが付いていた材料を未割当（null）に戻す
export function removeDish<R extends { dishId: string | null }>(
  dishes: Dish[],
  rows: R[],
  dishId: string
): { dishes: Dish[]; rows: R[] } {
  return {
    dishes: dishes.filter((d) => d.id !== dishId),
    rows: rows.map((r) => (r.dishId === dishId ? { ...r, dishId: null } : r)),
  };
}

// 単一選択。同じタグをもう一度選ぶと解除（null）になる
export function toggleDishId(current: string | null, selected: string | null): string | null {
  return selected === null || selected === current ? null : selected;
}

export function sortedDishes(dishes: Dish[]): Dish[] {
  return [...dishes].sort((a, b) => a.order - b.order);
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
  const unassigned = rows
    .map((row, index) => ({ row, index }))
    .filter((x) => x.row.dishId === null || !known.has(x.row.dishId));
  if (unassigned.length) groups.push({ dish: null, rows: unassigned });
  return groups;
}

// タグごとの淡い背景色（彩度を抑えた、既存の生成り系テーマに馴染む色）。表示順で割り当てる。
const DISH_TINTS = ["#f7ecc8", "#dfecd6", "#d9e6f2", "#f3dcdc", "#e6e0f0", "#d8ece8", "#f4e3d2", "#e8e8d6"];

export function dishTint(dishes: Dish[], dishId: string | null): string | undefined {
  if (dishId === null) return undefined;
  const idx = sortedDishes(dishes).findIndex((d) => d.id === dishId);
  return idx < 0 ? undefined : DISH_TINTS[idx % DISH_TINTS.length];
}
