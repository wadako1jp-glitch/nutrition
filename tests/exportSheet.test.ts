import { describe, expect, it } from "vitest";
import { computeRow } from "../src/core/nutrition";
import { findByCode } from "../src/data/foods";
import { buildExportSheet } from "../src/features/export-image/exportSheet";
import { loadTestFoods } from "./helpers/foods";

const foods = loadTestFoods();
const row = (code: string, g: string, dishId: string | null = null) => {
  const f = findByCode(foods, code)!;
  return { foodName: f.name, usedWeight: g, dishId, nutrients: computeRow(f, Number(g)) };
};

describe("共有用画像の中身", () => {
  it("タグなしの献立は材料の行と小計だけ（未割当 小計は出さない）", () => {
    const s = buildExportSheet({ rows: [row("01088", "150"), row("06061", "50")], dishes: [], title: "20260925_昼食", subtitle: "作成" });
    expect(s.rows.map((r) => r.kind)).toEqual(["item", "item", "subtotal"]);
    expect(s.header).toHaveLength(15); // 材料名・使用量・栄養素13
    const total = s.rows[2];
    expect(total.cells.slice(0, 3)).toEqual(["小計", "200", "245.5"]); // めし234 + キャベツ11.5（行ごとに丸めてから合計）
  });

  it("料理タグごとに色・チップ・タグの小計を付け、並びはタグ順→未割当", () => {
    const dishes = [
      { id: "a", name: "主食", order: 0 },
      { id: "b", name: "主菜", order: 1 },
    ];
    const s = buildExportSheet({
      rows: [row("06061", "50"), row("01088", "150", "a"), row("11221", "80", "b")],
      dishes,
      title: "t",
      subtitle: "s",
    });
    expect(s.rows.map((r) => `${r.kind}:${r.cells[0].slice(0, 6)}`)).toEqual([
      "item:こめ　［水稲",
      "dish-subtotal:主食 小計",
      "item:＜鳥肉類＞　",
      "dish-subtotal:主菜 小計",
      "item:（キャベツ類",
      "dish-subtotal:未割当 小計",
      "subtotal:献立 小計",
    ]);
    expect(s.rows[0]).toMatchObject({ chip: "主食", tint: "#f7ecc8" });
    expect(s.rows[4].chip).toBeUndefined();
  });
});
