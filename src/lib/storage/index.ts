// 永続化の抽象層。呼び出し側（menus.ts・profile.ts・settings.ts）はこのインターフェースだけを見て、
// 実装（今はブラウザの IndexedDB、将来ネイティブ化すればMMKV等）を意識しない。
// CLAUDE.md「技術スタック」参照。
//
// 保存の流れ:
//   1. 起動後はじめて使うときに IndexedDB を開く（indexedDbBackend.ts）。
//      以前のアプリが localStorage に保存したデータは、このとき IndexedDB へ写す（元は控えとして残す）。
//   2. 保存は IndexedDB に書き、同じ内容を localStorage にも控えとして書く（控えの失敗は無視）。
//   3. IndexedDB が使えない端末・状況では localStorage だけで動く（今までどおり）。
//      その間に書いた内容は、次に IndexedDB が使えたときに写し直す。
//   4. 保存に失敗したら画面に知らせる（saveStatus.ts）。
import { IndexedDbBackend } from "./indexedDbBackend";
import { LocalStorageBackend } from "./localStorageBackend";
import { reportSaveResult } from "./saveStatus";

export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const KEY_PREFIX = "nutritionApp."; // このアプリのキー（localStorage から写す対象）
// IndexedDB が使えず localStorage だけに書いた、という印（次に IndexedDB が使えたら写し直す）
const FALLBACK_DIRTY_KEY = "nutritionAppStorage.fallbackDirty";
const OPEN_TIMEOUT_MS = 3000;

interface StorageEnv {
  indexedDB?: IDBFactory;
  localStorage: globalThis.Storage;
  openTimeoutMs?: number;
}

// 保存先を決めて包む。テストでは偽の IndexedDB / localStorage を渡す
export function createStorage(getEnv: () => StorageEnv): Storage {
  let ready: Promise<{ primary: Storage; mirror: LocalStorageBackend | null; ls: globalThis.Storage }> | null = null;

  function init() {
    ready ??= (async () => {
      const env = getEnv();
      const ls = new LocalStorageBackend(env.localStorage);
      if (env.indexedDB) {
        try {
          const idb = await IndexedDbBackend.open(env.indexedDB, env.openTimeoutMs ?? OPEN_TIMEOUT_MS);
          await copyFromLocalStorage(idb, ls, env.localStorage);
          return { primary: idb as Storage, mirror: ls, ls: env.localStorage };
        } catch (e) {
          console.warn("IndexedDB が使えないため localStorage に保存します", e);
        }
      }
      return { primary: ls as Storage, mirror: null, ls: env.localStorage };
    })();
    return ready;
  }

  async function write(op: (s: Storage) => Promise<void>): Promise<void> {
    const { primary, mirror, ls } = await init();
    try {
      await op(primary);
    } catch (e) {
      reportSaveResult(false);
      throw e;
    }
    reportSaveResult(true);
    if (mirror) {
      await op(mirror).catch(() => {}); // 控え。失敗しても本体には保存できている
    } else {
      try {
        ls.setItem(FALLBACK_DIRTY_KEY, "1");
      } catch {
        // 印を書けなくても保存自体はできている
      }
    }
  }

  return {
    async get<T>(key: string) {
      return (await init()).primary.get<T>(key);
    },
    set<T>(key: string, value: T) {
      return write((s) => s.set(key, value));
    },
    remove(key: string) {
      return write((s) => s.remove(key));
    },
  };
}

// localStorage にあるこのアプリのデータを IndexedDB に写す。
// IndexedDB に無いキーだけ写す（はじめて IndexedDB を使うとき）。ただし前回 localStorage だけで
// 動いていた印があれば、そちらが新しいので全部写し直す
async function copyFromLocalStorage(idb: Storage, ls: LocalStorageBackend, raw: globalThis.Storage): Promise<void> {
  const dirty = raw.getItem(FALLBACK_DIRTY_KEY) !== null;
  for (const key of ls.keys(KEY_PREFIX)) {
    const value = await ls.get<unknown>(key);
    if (value === null) continue;
    if (dirty || (await idb.get(key)) === null) await idb.set(key, value);
  }
  if (dirty) raw.removeItem(FALLBACK_DIRTY_KEY);
}

// 「読んで・直して・書く」を1つずつ順番に行う（自動保存が続けて走っても、途中の変更を上書きで失わないように）
let queue: Promise<unknown> = Promise.resolve();
export function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export const storage: Storage = createStorage(() => ({
  indexedDB: typeof indexedDB === "undefined" ? undefined : indexedDB,
  localStorage: window.localStorage,
}));
