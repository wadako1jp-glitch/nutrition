// 永続化の抽象層。呼び出し側はこのインターフェースだけを見て、
// 実装（今はブラウザのlocalStorage/IndexedDB、将来ネイティブ化すればMMKV等）を意識しない。
// CLAUDE.md「技術スタック」参照。

export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

// v1実装: localStorage。小さいJSON（献立データ、設定）で十分な間はこれで足りる。
// 献立データが増えて重くなったらIndexedDB実装に差し替える（呼び出し側は無変更）。
class LocalStorageBackend implements Storage {
  async get<T>(key: string): Promise<T | null> {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }
}

export const storage: Storage = new LocalStorageBackend();
