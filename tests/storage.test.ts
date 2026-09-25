import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createStorage, serialize } from "../src/lib/storage/index";
import { hasSaveFailed, reportSaveResult } from "../src/lib/storage/saveStatus";

// テスト用の localStorage（中身は Map）。quotaFull にすると書き込みで例外（容量不足）になる
class FakeLocalStorage implements Storage {
  map = new Map<string, string>();
  quotaFull = false;
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.quotaFull) throw new Error("QuotaExceededError");
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
}

const MENUS = "nutritionApp.menus.v1";
const DIRTY = "nutritionAppStorage.fallbackDirty";

let ls: FakeLocalStorage;
let idb: IDBFactory;
beforeEach(() => {
  ls = new FakeLocalStorage();
  idb = new IDBFactory();
  reportSaveResult(true);
});

describe("保存（IndexedDB ＋ localStorage の控え）", () => {
  it("以前の localStorage のデータを初回に IndexedDB へ写す（元は残す。他のアプリのキーは写さない）", async () => {
    ls.setItem(MENUS, JSON.stringify([{ id: "m1" }]));
    ls.setItem("other.key", JSON.stringify(1));
    const s = createStorage(() => ({ indexedDB: idb, localStorage: ls }));
    expect(await s.get(MENUS)).toEqual([{ id: "m1" }]);

    // localStorage を空にしても IndexedDB から読める＝写せている
    const onlyIdb = createStorage(() => ({ indexedDB: idb, localStorage: new FakeLocalStorage() }));
    expect(await onlyIdb.get(MENUS)).toEqual([{ id: "m1" }]);
    expect(await onlyIdb.get("other.key")).toBeNull();
    expect(ls.getItem(MENUS)).not.toBeNull();
  });

  it("保存は IndexedDB に書き、localStorage にも同じ内容の控えを書く", async () => {
    const s = createStorage(() => ({ indexedDB: idb, localStorage: ls }));
    await s.set(MENUS, [{ id: "m2" }]);
    expect(JSON.parse(ls.getItem(MENUS)!)).toEqual([{ id: "m2" }]);
    const onlyIdb = createStorage(() => ({ indexedDB: idb, localStorage: new FakeLocalStorage() }));
    expect(await onlyIdb.get(MENUS)).toEqual([{ id: "m2" }]);
    await s.remove(MENUS);
    expect(await s.get(MENUS)).toBeNull();
    expect(ls.getItem(MENUS)).toBeNull();
  });

  it("IndexedDB に既にあるデータを、古い localStorage の内容で上書きしない", async () => {
    await createStorage(() => ({ indexedDB: idb, localStorage: new FakeLocalStorage() })).set(MENUS, ["新しい"]);
    ls.setItem(MENUS, JSON.stringify(["古い"]));
    const s = createStorage(() => ({ indexedDB: idb, localStorage: ls }));
    expect(await s.get(MENUS)).toEqual(["新しい"]);
  });

  it("IndexedDB が使えないときは localStorage だけで動き、次に使えたときにその内容を写し直す", async () => {
    await createStorage(() => ({ indexedDB: idb, localStorage: ls })).set(MENUS, ["IndexedDBが使えた時"]);
    const fallback = createStorage(() => ({ indexedDB: undefined, localStorage: ls }));
    expect(await fallback.get(MENUS)).toEqual(["IndexedDBが使えた時"]); // 控えがあるので続きから使える
    await fallback.set(MENUS, ["localStorageだけの時"]);
    expect(ls.getItem(DIRTY)).not.toBeNull();

    const next = createStorage(() => ({ indexedDB: idb, localStorage: ls }));
    expect(await next.get(MENUS)).toEqual(["localStorageだけの時"]);
    expect(ls.getItem(DIRTY)).toBeNull();
  });

  it("IndexedDB の準備が返ってこない端末では、待ちすぎずに localStorage に切り替える", async () => {
    const hanging = { open: () => ({}) } as unknown as IDBFactory; // 返事が来ない
    ls.setItem(MENUS, JSON.stringify(["控え"]));
    const s = createStorage(() => ({ indexedDB: hanging, localStorage: ls, openTimeoutMs: 20 }));
    expect(await s.get(MENUS)).toEqual(["控え"]);
  });

  it("保存に失敗したら知らせ、次に保存できたら取り消す", async () => {
    const s = createStorage(() => ({ indexedDB: undefined, localStorage: ls }));
    ls.quotaFull = true;
    await expect(s.set(MENUS, ["x"])).rejects.toThrow();
    expect(hasSaveFailed()).toBe(true);
    ls.quotaFull = false;
    await s.set(MENUS, ["x"]);
    expect(hasSaveFailed()).toBe(false);
  });

  it("控え（localStorage）が容量不足でも、IndexedDB に保存できていれば成功扱い", async () => {
    const s = createStorage(() => ({ indexedDB: idb, localStorage: ls }));
    await s.get(MENUS);
    ls.quotaFull = true;
    await s.set(MENUS, ["x"]);
    expect(hasSaveFailed()).toBe(false);
    expect(await s.get(MENUS)).toEqual(["x"]);
  });
});

describe("読んで・直して・書くを順番に行う（serialize）", () => {
  it("同時に走っても、途中の変更を上書きで失わない", async () => {
    let saved: string[] = [];
    const tick = () => new Promise((r) => setTimeout(r, 1));
    const add = (x: string) =>
      serialize(async () => {
        const cur = [...saved];
        await tick(); // 読んでから書くまでに間がある
        saved = [...cur, x];
      });
    await Promise.all([add("a"), add("b"), add("c")]);
    expect(saved).toEqual(["a", "b", "c"]);
  });

  it("1つが失敗しても、次の処理は動く", async () => {
    const failed = serialize(async () => {
      throw new Error("x");
    });
    await expect(failed).rejects.toThrow();
    await expect(serialize(async () => 1)).resolves.toBe(1);
  });
});
