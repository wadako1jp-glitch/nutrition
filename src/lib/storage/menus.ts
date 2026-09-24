// 献立の保存・一覧・編集・削除。既存の永続化抽象層（src/lib/storage/index.ts）の上に薄く実装する。
// CLAUDE.md「技術スタック」参照。データ本体は食品コード＋使用量のみ持ち、食品名や成分値は
// 読み込み時に成分表（src/data/foods.ts）から都度解決する（成分表の版が変わっても壊れない）。
import { storage } from "./index";

export interface StoredMenuRow {
  code: string; // 食品番号
  usedWeight: string; // 使用量(g)。正規化済み（半角）の文字列で保存する
}

export interface StoredMenu {
  id: string;
  title: string;
  rows: StoredMenuRow[];
  createdAt: number;
  updatedAt: number;
}

const KEY = "nutritionApp.menus.v1";

async function readAll(): Promise<StoredMenu[]> {
  const list = await storage.get<StoredMenu[]>(KEY);
  return Array.isArray(list) ? list : [];
}

async function writeAll(menus: StoredMenu[]): Promise<void> {
  await storage.set(KEY, menus);
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
  const all = await readAll();
  const idx = all.findIndex((m) => m.id === menu.id);
  if (idx >= 0) all[idx] = menu;
  else all.push(menu);
  await writeAll(all);
}

export async function deleteMenu(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((m) => m.id !== id));
}

export function createMenuId(): string {
  return `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 献立名が未入力のときのデフォルト名。「献立1」「献立2」...を欠番も埋めつつ振る。
export async function nextDefaultTitle(): Promise<string> {
  const all = await readAll();
  const used = new Set(all.map((m) => m.title));
  let n = 1;
  while (used.has(`献立${n}`)) n++;
  return `献立${n}`;
}
