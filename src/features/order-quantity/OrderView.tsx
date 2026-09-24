// 発注量の表示（有料機能候補「発注量算出」）。材料表とは別の画面で、
// 使用量（可食部・1人分）から人数分の発注量と、成分表の廃棄率・廃棄部位（何を切り捨てた量か）を示す。
// 栄養計算は引き続き使用量で行い、この画面の数字は栄養計算には使わない。
import { useEffect, useState } from "react";
import { groupRowsByDish, Dish } from "../../core/dishes";
import { MAX_SERVINGS, OrderLine, orderLine, parseServings } from "../../core/order";
import { round1 } from "../../core/nutrition";
import { weightValue } from "../../core/weightInput";
import { Food } from "../../data/foods";
import { CURRENT_FOOD_TABLE } from "../../data/foodTable";

interface OrderRow {
  id: number;
  food: Food;
  usedWeight: string;
  dishId: string | null;
}

export default function OrderView({
  rows,
  dishes,
  servings,
  onServingsChange,
  onClose,
}: {
  rows: OrderRow[];
  dishes: Dish[];
  servings: number;
  onServingsChange: (n: number) => void;
  onClose: () => void;
}) {
  // 入力途中（空欄など）も打てるよう、欄の文字列は別に持ち、妥当な値になったときだけ反映する
  const [servingsText, setServingsText] = useState(String(servings));
  useEffect(() => setServingsText(String(servings)), [servings]);
  const servingsInvalid = parseServings(servingsText) === null;

  const groups = groupRowsByDish(rows, dishes);
  const lines = new Map<number, OrderLine>(rows.map((r) => [r.id, orderLine(r.food, weightValue(r.usedWeight), servings)]));
  const all = [...lines.values()];
  const totalUsed = round1(all.reduce((a, l) => a + l.usedTotal, 0));
  const totalOrder = round1(all.reduce((a, l) => a + l.orderTotal, 0));
  const totalDiscard = round1(all.reduce((a, l) => a + l.discardTotal, 0));
  const discarding = all.filter((l) => l.wastePct > 0).length;

  return (
    <div className="order-view">
      <div className="order-head">
        <label className="order-servings">
          人数
          <input
            className={`num${servingsInvalid ? " invalid" : ""}`}
            value={servingsText}
            inputMode="numeric"
            aria-label="発注する人数"
            onChange={(e) => {
              setServingsText(e.target.value);
              const n = parseServings(e.target.value);
              if (n !== null) onServingsChange(n);
            }}
            onBlur={() => setServingsText(String(servings))}
          />
          人分
        </label>
        <button type="button" className="mode-toggle" onClick={onClose}>
          材料表に戻る
        </button>
      </div>
      {servingsInvalid && <p className="weight-warning">1〜{MAX_SERVINGS}の整数で入力してください（{servings}人分で計算中）</p>}

      {rows.length === 0 ? (
        <p className="note">材料が入力されていません。</p>
      ) : (
        <div className="sheet">
          <div className="sheet-scroll">
            <table className="sheet-table order-table">
              <thead>
                <tr>
                  <th className="col-name">材料名</th>
                  <th>
                    使用量
                    <br />
                    (g/人)
                  </th>
                  <th className="col-waste-part">
                    廃棄率・廃棄部位
                    <br />
                    （切り捨てる部分）
                  </th>
                  <th className="col-order-total">
                    発注量
                    <br />
                    (g/{servings}人)
                  </th>
                  <th>
                    発注量
                    <br />
                    (g/人)
                  </th>
                  <th>
                    うち廃棄
                    <br />
                    (g/{servings}人)
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) =>
                  g.rows.map(({ row }) => {
                    const l = lines.get(row.id)!;
                    return (
                      <tr key={row.id}>
                        <td className="col-name">
                          <span className="food-name" title={row.food.name}>
                            {row.food.name}
                          </span>
                        </td>
                        <td className="num">{l.usedPerPerson}</td>
                        <td className="col-waste-part">
                          {l.wastePct === 0 ? (
                            <span className="waste-none">廃棄なし</span>
                          ) : (
                            <>
                              <span className="waste-pct">{l.wastePct}%</span>{" "}
                              {l.wastePart ?? <span className="waste-none">部位は成分表に記載なし</span>}
                            </>
                          )}
                        </td>
                        <td className="num col-order-total">{l.orderTotal}</td>
                        <td className="num">{l.orderPerPerson}</td>
                        <td className="num">{l.discardTotal}</td>
                      </tr>
                    );
                  }),
                )}
                <tr className="subtotal">
                  <td className="col-name">合計</td>
                  <td className="num"></td>
                  <td className="col-waste-part">{discarding}品目で廃棄あり</td>
                  <td className="num col-order-total">{totalOrder}</td>
                  <td className="num"></td>
                  <td className="num">{totalDiscard}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="note">
        発注量 = 使用量 ÷ (1 − 廃棄率/100)。人数分は「使用量×人数」を割り戻して小数第1位で丸めています（使用量の合計 {totalUsed}
        g）。廃棄率・廃棄部位は{CURRENT_FOOD_TABLE.label}の値で、廃棄部位は成分表の備考欄の記載です。栄養計算は使用量（可食部）で行い、発注量は使いません。
      </p>
    </div>
  );
}
