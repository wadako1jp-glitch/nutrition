// 保存先その2（今の保存先）: ブラウザの IndexedDB。
// localStorage より容量が大きく、保存中に画面を止めない。中身は「キー → 値」の表1つだけで、
// 使い方は localStorage と同じ（get / set / remove）。
import type { Storage } from "./index";

const DB_NAME = "nutritionApp";
const STORE = "kv"; // キー → 値 の表
const DB_VERSION = 1;

export class IndexedDbBackend implements Storage {
  private constructor(private readonly db: IDBDatabase) {}

  // データベースを開く。開けない・timeoutMs 以内に返事が無い場合は失敗（呼び出し側で localStorage に切り替える）
  static open(factory: IDBFactory, timeoutMs: number): Promise<IndexedDbBackend> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(new Error("IndexedDB の準備に時間がかかりすぎました"));
      }, timeoutMs);
      let req: IDBOpenDBRequest;
      try {
        req = factory.open(DB_NAME, DB_VERSION);
      } catch (e) {
        clearTimeout(timer);
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        if (settled) {
          req.result.close(); // 時間切れの後に開けても使わない
        } else {
          resolve(new IndexedDbBackend(req.result));
        }
      };
      req.onerror = () => {
        clearTimeout(timer);
        if (!settled) reject(req.error ?? new Error("IndexedDB を開けませんでした"));
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.run<unknown>("readonly", (s) => s.get(key));
    return value === undefined ? null : (value as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.run("readwrite", (s) => s.put(value, key));
  }

  async remove(key: string): Promise<void> {
    await this.run("readwrite", (s) => s.delete(key));
  }

  // 1回の読み書き。書き込みは「書き終わった（transaction complete）」まで待ってから成功とする
  private run<R>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<R> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      let req: IDBRequest;
      try {
        tx = this.db.transaction(STORE, mode);
        req = op(tx.objectStore(STORE));
      } catch (e) {
        reject(e);
        return;
      }
      tx.oncomplete = () => resolve(req.result as R);
      tx.onerror = () => reject(tx.error ?? req.error ?? new Error("IndexedDB への保存に失敗しました"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB への保存が中断されました"));
    });
  }
}
