// 永続化の抽象層。呼び出し側（menus.ts・profile.ts・settings.ts）はこのインターフェースだけを見て、
// 実装（今はブラウザの localStorage、将来ネイティブ化すればMMKV等）を意識しない。CLAUDE.md「技術スタック」参照。
// 保存に失敗したら saveStatus.ts 経由で画面に知らせる（容量不足・ブラウザの制限など）。
import { reportSaveResult } from "./saveStatus";

export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  // 読んで・直して・書くを一度に行う（途中に別の保存が割り込まない）
  update<T>(key: string, fn: (current: T | null) => T): Promise<void>;
  remove(key: string): Promise<void>;
}

type WebStorage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

// localStorage は読み書きがその場で終わるので、update の中で他の保存が割り込むことはない
export function createStorage(getLs: () => WebStorage): Storage {
  function read<T>(key: string): T | null {
    const raw = getLs().getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function write(op: () => void): void {
    try {
      op();
    } catch (e) {
      reportSaveResult(false);
      throw e;
    }
    reportSaveResult(true);
  }

  return {
    async get<T>(key: string) {
      return read<T>(key);
    },
    async set<T>(key: string, value: T) {
      write(() => getLs().setItem(key, JSON.stringify(value)));
    },
    async update<T>(key: string, fn: (current: T | null) => T) {
      write(() => getLs().setItem(key, JSON.stringify(fn(read<T>(key)))));
    },
    async remove(key: string) {
      write(() => getLs().removeItem(key));
    },
  };
}

export const storage: Storage = createStorage(() => window.localStorage);
