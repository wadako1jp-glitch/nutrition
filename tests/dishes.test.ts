import { describe, expect, it } from "vitest";
import { addDish, dishTint, groupRowsByDish, removeDish, toggleDishId } from "../src/core/dishes";
import { normalizeMenu } from "../src/lib/storage/menus";

describe("料理タグ", () => {
  it("同名タグは登録できない（前後の空白は無視）", () => {
    const a = addDish([], "主菜", "d1");
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = addDish(a.dishes, " 主菜 ", "d2");
    expect(b).toEqual({ ok: false, error: "「主菜」は既にあります" });
    expect(addDish(a.dishes, "  ").ok).toBe(false);
  });

  it("order は追加順に振られる", () => {
    let dishes = [] as ReturnType<typeof addDish> extends { dishes: infer D } ? D : never;
    for (const [i, n] of ["主食", "主菜", "汁物"].entries()) {
      const r = addDish(dishes, n, `d${i}`);
      if (r.ok) dishes = r.dishes;
    }
    expect(dishes.map((d) => d.order)).toEqual([0, 1, 2]);
  });

  it("同じタグを選び直すと解除、なし(null)でも解除", () => {
    expect(toggleDishId(null, "d1")).toBe("d1");
    expect(toggleDishId("d1", "d1")).toBeNull();
    expect(toggleDishId("d1", "d2")).toBe("d2");
    expect(toggleDishId("d1", null)).toBeNull();
  });

  it("タグ削除で材料は消えず未割当になる", () => {
    const dishes = [
      { id: "a", name: "主食", order: 0 },
      { id: "b", name: "主菜", order: 1 },
    ];
    const rows = [
      { code: "1", dishId: "a" },
      { code: "2", dishId: "b" },
    ];
    const next = removeDish(dishes, rows, "b");
    expect(next.dishes.map((d) => d.id)).toEqual(["a"]);
    expect(next.rows).toEqual([
      { code: "1", dishId: "a" },
      { code: "2", dishId: null },
    ]);
  });

  it("並び順はタグ順→登録順、未割当は末尾。空のタグ・未割当はグループを作らない", () => {
    const dishes = [
      { id: "shu", name: "主菜", order: 1 },
      { id: "shoku", name: "主食", order: 0 },
      { id: "shiru", name: "汁物", order: 2 },
    ];
    const rows = [
      { code: "r0", dishId: "shu" },
      { code: "r1", dishId: null },
      { code: "r2", dishId: "shoku" },
      { code: "r3", dishId: "shu" },
    ];
    const groups = groupRowsByDish(rows, dishes);
    expect(groups.map((g) => g.dish?.name ?? "未割当")).toEqual(["主食", "主菜", "未割当"]);
    expect(groups[1].rows.map((x) => x.row.code)).toEqual(["r0", "r3"]);
    expect(groupRowsByDish(rows.filter((r) => r.dishId), dishes).some((g) => g.dish === null)).toBe(false);
  });

  it("未割当はハイライトなし、タグごとに別の色", () => {
    const dishes = [
      { id: "a", name: "主食", order: 0 },
      { id: "b", name: "主菜", order: 1 },
    ];
    expect(dishTint(dishes, null)).toBeUndefined();
    expect(dishTint(dishes, "a")).not.toBe(dishTint(dishes, "b"));
  });
});

describe("献立データの後方互換", () => {
  it("料理タグ導入前のデータは dishes=[]・dishId=null で読める", () => {
    const old = { id: "m1", title: "献立1", rows: [{ code: "01083", usedWeight: "75" }], createdAt: 1, updatedAt: 2 };
    expect(normalizeMenu(old)).toEqual({
      id: "m1",
      title: "献立1",
      dishes: [],
      rows: [{ code: "01083", usedWeight: "75", dishId: null }],
      createdAt: 1,
      updatedAt: 2,
    });
  });

  it("存在しないタグを指す dishId は未割当に戻す", () => {
    const m = normalizeMenu({
      id: "m1",
      title: "t",
      dishes: [{ id: "a", name: "主食", order: 0 }],
      rows: [
        { code: "1", usedWeight: "1", dishId: "a" },
        { code: "2", usedWeight: "1", dishId: "ghost" },
      ],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(m.rows.map((r) => r.dishId)).toEqual(["a", null]);
  });
});
