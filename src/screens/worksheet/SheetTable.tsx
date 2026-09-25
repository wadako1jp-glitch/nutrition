// 材料表（栄養価計算用紙と同じ形の表）。1行＝1材料で、打ったそばから栄養価が埋まる。
// 並びは料理タグ順→登録順（未割当は最後）、タグごとに小計、最後に献立の小計。
// 縦持ち・横持ち（ワイド表示）の見た目の切り替えは styles.css だけで行う（表の中身はどちらも同じ）。
import { Fragment } from "react";
import { Dish, RowGroup, dishTint, groupRowsByDish } from "../../core/dishes";
import { NUTRIENT_KEYS, NUTRIENT_LABELS, NutrientRow, round1, sumRows } from "../../core/nutrition";
import { weightHasWarning, weightValue, weightWarningMessage } from "../../core/weightInput";
import DishSelect from "./DishSelect";
import { Row, tintStyle } from "./rows";

export default function SheetTable({
  rows,
  dishes,
  nutrientRows,
  subtotal,
  totalWeight,
  onDeleteRequest,
  onWeightChange,
  onDishChange,
}: {
  rows: Row[];
  dishes: Dish[];
  nutrientRows: NutrientRow[]; // rows と同じ並びの、行ごとの栄養価（丸め済み）
  subtotal: NutrientRow;
  totalWeight: number;
  onDeleteRequest: (rowId: number) => void; // 「×」を押した
  onWeightChange: (rowId: number, value: string) => void;
  onDishChange: (rowId: number, value: string) => void; // 料理タグのプルダウンの値
}) {
  const groups = groupRowsByDish(rows, dishes);
  return (
    <div className="sheet">
      <div className="sheet-scroll">
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="col-del"></th>
              <th className="col-name">材料名</th>
              <th className="col-weight">
                使用量
                <br />
                (g)
              </th>
              {NUTRIENT_KEYS.map((k) => (
                <th key={k}>
                  {NUTRIENT_LABELS[k][0]}
                  <br />({NUTRIENT_LABELS[k][1]})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.dish?.id ?? "unassigned"}>
                {g.rows.map(({ row, index: i }) => {
                  const computed = nutrientRows[i];
                  // 確定済みの行で使用量が空欄なのは「入力し忘れ」なので、
                  // 数字の形の警告（weightHasWarning）とは別に必ず警告を出す
                  const isBlank = row.usedWeight.trim() === "";
                  const warn = isBlank || weightHasWarning(row.usedWeight);
                  const warnMsg = isBlank ? "使用量が未入力です（0として計算中）" : weightWarningMessage(row.usedWeight);
                  const rowDish = g.dish;
                  return (
                    <Fragment key={row.id}>
                      <tr style={tintStyle(dishTint(dishes, row.dishId))}>
                        <td className="col-del">
                          <button
                            type="button"
                            className="row-del-btn"
                            aria-label={`「${row.food.name}」を削除`}
                            onClick={() => onDeleteRequest(row.id)}
                          >
                            ×
                          </button>
                        </td>
                        <td className="col-name">
                          <div className="name-cell">
                            <span className="food-name" title={row.food.name}>
                              {row.food.name}
                            </span>
                            <DishSelect
                              dishes={dishes}
                              value={rowDish ? rowDish.name : null}
                              emptyLabel="タグなし"
                              className={`dish-chip${rowDish ? "" : " empty"}`}
                              ariaLabel={`${row.food.name}の料理タグ`}
                              onChange={(v) => onDishChange(row.id, v)}
                            />
                          </div>
                        </td>
                        <td className="col-weight">
                          <input
                            className={`num${warn ? " invalid" : ""}`}
                            value={row.usedWeight}
                            inputMode="decimal"
                            onChange={(e) => onWeightChange(row.id, e.target.value)}
                            title={warnMsg ?? undefined}
                            aria-label={`${row.food.name}の使用量(g)`}
                          />
                          {warn && (
                            <span className="weight-warning-mark" title={warnMsg ?? undefined}>
                              ⚠
                            </span>
                          )}
                        </td>
                        {NUTRIENT_KEYS.map((k) => (
                          <td key={k} className="num">
                            {computed[k]}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
                {showGroupSubtotal(g, dishes) && (
                  <GroupSubtotalRow group={g} dishes={dishes} nutrientRows={nutrientRows} withDelColumn />
                )}
              </Fragment>
            ))}
            <tr className="subtotal">
              <td className="col-del"></td>
              <td className="col-name">{dishes.length ? "献立 小計" : "小計"}</td>
              <td className="col-weight num">{rows.length ? totalWeight : ""}</td>
              {NUTRIENT_KEYS.map((k) => (
                <td key={k} className="num">
                  {rows.length ? subtotal[k] : ""}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 料理ごとの小計行を出すか。タグを1つも作っていない献立では、
// 「未割当 小計」が献立小計と全く同じ行になるだけなので出さない。
export function showGroupSubtotal(g: RowGroup<Row>, dishes: Dish[]): boolean {
  return g.dish !== null || dishes.length > 0;
}

// 料理タグごとの小計行（献立小計と同じ14項目）。画像用表示の表でも使う
export function GroupSubtotalRow({
  group,
  dishes,
  nutrientRows,
  withDelColumn,
}: {
  group: RowGroup<Row>;
  dishes: Dish[];
  nutrientRows: NutrientRow[];
  withDelColumn: boolean;
}) {
  const sub = sumRows(group.rows.map((x) => nutrientRows[x.index]));
  const weight = round1(group.rows.reduce((acc, x) => acc + weightValue(x.row.usedWeight), 0));
  return (
    <tr className="dish-subtotal" style={tintStyle(group.dish ? dishTint(dishes, group.dish.id) : undefined)}>
      {withDelColumn && <td className="col-del"></td>}
      <td className="col-name">{group.dish ? group.dish.name : "未割当"} 小計</td>
      <td className="col-weight num">{weight}</td>
      {NUTRIENT_KEYS.map((k) => (
        <td key={k} className="num">
          {sub[k]}
        </td>
      ))}
    </tr>
  );
}
