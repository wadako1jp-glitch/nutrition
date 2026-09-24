// アプリの設定（端末内に1件）。
import { storage } from "./index";

export interface Settings {
  // 材料の削除で確認ポップアップを出さない（削除確認の「次から確認しない」にチェックすると true）
  skipRowDeleteConfirm: boolean;
}

const KEY = "nutritionApp.settings.v1";
const DEFAULTS: Settings = { skipRowDeleteConfirm: false };

export async function getSettings(): Promise<Settings> {
  const s = await storage.get<Partial<Settings>>(KEY);
  return { ...DEFAULTS, ...(s ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await storage.set(KEY, next);
  return next;
}
