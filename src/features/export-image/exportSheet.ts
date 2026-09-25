// 共有用の画像（横長PNG）に載せる内容を組み立てる（Reactにも画面にも依存しない純粋関数）。
// 画像用表示の表と同じ中身: 献立名・作成日・材料ごとの行・料理タグごとの小計・献立の小計。
// 描くのは drawExportSheet.ts。ここで「何を載せるか」、あちらで「どう描くか」を分けている。
import { Dish, dishTint, groupRowsByDish } from "../../core/dishes";
import { NUTRIENT_KEYS, NUTRIENT_LABELS, NutrientRow, round1, sumRows } from "../../core/nutrition";
import { weightValue } from "../../core/weightInput";

export interface ExportInputRow {
  foodName: string;
  usedWeight: string; // 入力された使用量（そのまま表示する）
  dishId: string | null;
  nutrients: NutrientRow; // 行ごとに丸め済みの栄養価
}

export type ExportRowKind = "item" | "dish-subtotal" | "subtotal";

export interface ExportSheetRow {
  kind: ExportRowKind;
  cells: string[]; // [材料名, 使用量, 栄養素×13]
  tint?: string; // 料理タグの淡い背景色
  chip?: string; // 材料名の後ろに付ける料理タグ名
}

export interface ExportSheet {
  title: string;
  subtitle: string;
  header: [string, string][]; // 見出し（2段）
  rows: ExportSheetRow[];
}

const num = (n: number) => String(n);

export function buildExportSheet(input: { rows: ExportInputRow[]; dishes: Dish[]; title: string; subtitle: string }): ExportSheet {
  const header: [string, string][] = [
    ["材料名", ""],
    ["使用量", "(g)"],
    ...NUTRIENT_KEYS.map((k) => [NUTRIENT_LABELS[k][0], `(${NUTRIENT_LABELS[k][1]})`] as [string, string]),
  ];
  const dishes = input.dishes;
  const out: ExportSheetRow[] = [];
  for (const g of groupRowsByDish(input.rows, dishes)) {
    for (const { row } of g.rows) {
      out.push({
        kind: "item",
        cells: [row.foodName, row.usedWeight || "0", ...NUTRIENT_KEYS.map((k) => num(row.nutrients[k]))],
        tint: dishTint(dishes, row.dishId),
        chip: g.dish?.name,
      });
    }
    // タグを1つも使っていない献立では「未割当 小計」は献立小計と同じなので出さない（入力画面と同じ）
    if (g.dish !== null || dishes.length > 0) {
      const sub = sumRows(g.rows.map(({ row }) => row.nutrients));
      const weight = round1(g.rows.reduce((a, { row }) => a + weightValue(row.usedWeight), 0));
      out.push({
        kind: "dish-subtotal",
        cells: [`${g.dish ? g.dish.name : "未割当"} 小計`, num(weight), ...NUTRIENT_KEYS.map((k) => num(sub[k]))],
        tint: g.dish ? dishTint(dishes, g.dish.id) : undefined,
      });
    }
  }
  if (input.rows.length) {
    const total = sumRows(input.rows.map((r) => r.nutrients));
    const weight = round1(input.rows.reduce((a, r) => a + weightValue(r.usedWeight), 0));
    out.push({
      kind: "subtotal",
      cells: [dishes.length ? "献立 小計" : "小計", num(weight), ...NUTRIENT_KEYS.map((k) => num(total[k]))],
    });
  }
  return { title: input.title, subtitle: input.subtitle, header, rows: out };
}
