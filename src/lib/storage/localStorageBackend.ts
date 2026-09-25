// 保存先その1: ブラウザの localStorage（文字で保存する小さな保存場所）。
// 今の保存先は IndexedDB（indexedDbBackend.ts）で、こちらは
//   - IndexedDB が使えない端末・状況での代わり
//   - IndexedDB に保存した内容の控え（同じ内容を書いておく）
// として使う。以前のアプリはここにだけ保存していた（初回に IndexedDB へ移す: index.ts）。
import type { Storage } from "./index";

export class LocalStorageBackend implements Storage {
  constructor(private readonly ls: globalThis.Storage) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = this.ls.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.ls.setItem(key, JSON.stringify(value)); // 容量不足などは例外になる
  }

  async remove(key: string): Promise<void> {
    this.ls.removeItem(key);
  }

  // 指定の文字で始まるキーの一覧（IndexedDB への引っ越し用）
  keys(prefix: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.ls.length; i++) {
      const k = this.ls.key(i);
      if (k !== null && k.startsWith(prefix)) out.push(k);
    }
    return out;
  }
}
