import { beforeEach, describe, expect, it } from "vitest";
import { createStorage } from "../src/lib/storage/index";
import { hasSaveFailed, reportSaveResult } from "../src/lib/storage/saveStatus";

// localStorage の代わり。full にすると書き込みが失敗する（容量不足）
let data: Map<string, string>;
let full: boolean;
const storage = createStorage(() => ({
  getItem: (k) => data.get(k) ?? null,
  setItem: (k, v) => {
    if (full) throw new Error("QuotaExceededError");
    data.set(k, v);
  },
  removeItem: (k) => void data.delete(k),
}));

beforeEach(() => {
  data = new Map();
  full = false;
  reportSaveResult(true);
});

describe("保存", () => {
  it("同時に走った update も、互いの変更を消さない", async () => {
    await Promise.all(["a", "b", "c"].map((x) => storage.update<string[]>("k", (cur) => [...(cur ?? []), x])));
    expect(await storage.get("k")).toEqual(["a", "b", "c"]);
  });

  it("保存に失敗したら知らせ、次に保存できたら取り消す", async () => {
    full = true;
    await expect(storage.set("k", 1)).rejects.toThrow();
    expect(hasSaveFailed()).toBe(true);
    full = false;
    await storage.set("k", 1);
    expect(hasSaveFailed()).toBe(false);
  });
});
