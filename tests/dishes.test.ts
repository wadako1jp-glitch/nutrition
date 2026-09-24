import { describe, expect, it } from "vitest";
import { dishOptionNames, dishTint, ensureDish, groupRowsByDish, pruneUnusedDishes } from "../src/core/dishes";
import { normalizeMenu } from "../src/lib/storage/menus";

describe("料理タグ", () => {
  it("選んだ名前のタグが無ければ作り、同名があれば同じタグを使う（前後の空白は無視）", () => {
    const a = ensureDish([], "主菜", "d1");
    expect(a).toMatchObject({ ok: true, id: "d1" });
    if (!a.ok) return;
    const b = ensureDish(a.dishes, " 主菜 ", "d2");
    expect(b).toMatchObject({ ok: true, id: "d1" });
    if (b.ok) expect(b.dishes).toHaveLength(1);
    expect(ensureDish(a.dishes, "  ").ok).toBe(false);
  });

  it("並び順は朝食→昼食→夕食→間食で固定。旧版のタグ（主食など）は使われている間だけ後ろに出る", () => {
    let dishes: Parameters<typeof ensureDish>[0] = [];
    for (const [i, n] of ["夕食", "主食", "朝食"].entries()) {
      const r = ensureDish(dishes, n, `d${i}`);
      if (r.ok) dishes = r.dishes;
    }
    const byName = Object.fromEntries(dishes.map((d) => [d.name, d.order]));
    expect(byName["朝食"]).toBeLessThan(byName["夕食"]);
    expect(byName["夕食"]).toBeLessThan(byName["主食"]);
    expect(dishOptionNames(dishes)).toEqual(["朝食", "昼食", "夕食", "間食", "主食"]);
    expect(dishOptionNames([])).toEqual(["朝食", "昼食", "夕食", "間食"]);
  });

  it("どの材料にも使われなくなったタグは消える（材料は消えない）", () => {
    const dishes = [
      { id: "a", name: "主食", order: 0 },
      { id: "b", name: "主菜", order: 1 },
    ];
    const rows = [
      { code: "1", dishId: "a" },
      { code: "2", dishId: null },
    ];
    expect(pruneUnusedDishes(dishes, rows).map((d) => d.id)).toEqual(["a"]);
    expect(pruneUnusedDishes(dishes, [...rows, { code: "3", dishId: "b" }])).toBe(dishes);
  });

  it("並び順はタグ順→登録順、未割当は末尾。空のタグ・未割当はグループを作らない", () => {
    const dishes = [
      { id: "shu", name: "主菜", order: 1 },
      { id: "shoku", name: "主食", order: 0 },
      { id: "shiru", name: "汁物", order: 4 },
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

  it("未割当はハイライトなし、タグごとに別の色で、他のタグの有無で色が変わらない", () => {
    const shoku = { id: "a", name: "主食", order: 0 };
    const shiru = { id: "c", name: "汁物", order: 4 };
    const dishes = [shoku, { id: "b", name: "主菜", order: 1 }, shiru];
    expect(dishTint(dishes, null)).toBeUndefined();
    expect(dishTint(dishes, "a")).not.toBe(dishTint(dishes, "b"));
    expect(dishTint([shiru], "c")).toBe(dishTint(dishes, "c"));
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
