import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  Food,
  cellValue,
  findByCode,
  loadFoods,
  searchFoods,
} from "../data/foods";
import { NUTRIENT_KEYS, NutrientRow, computeRow, round1, sumRows } from "../core/nutrition";
import {
  isValidWeightNumber,
  normalizeWeightInput,
  weightHasWarning,
  weightValue,
  weightWarningMessage,
} from "../core/weightInput";
import { StoredMenu, createMenuId, deleteMenu, getMenu, nextDefaultTitle, upsertMenu } from "../lib/storage/menus";

// 用紙の列見出し（CLAUDE.md「UI・入力体験の要件」参照）
const COLUMN_LABELS: Record<(typeof NUTRIENT_KEYS)[number], [string, string]> = {
  kcal: ["エネルギー", "kcal"],
  protein_g: ["蛋白質", "g"],
  fat_g: ["脂質", "g"],
  carb_g: ["炭水化物", "g"],
  fiber_g: ["食物繊維", "g"],
  ca_mg: ["カルシウム", "mg"],
  fe_mg: ["鉄", "mg"],
  va_ugRAE: ["ビタミンA", "μgRAE"],
  vd_ug: ["ビタミンD", "μg"],
  vb1_mg: ["ビタミンB1", "mg"],
  vb2_mg: ["ビタミンB2", "mg"],
  vc_mg: ["ビタミンC", "mg"],
  salt_g: ["食塩相当量", "g"],
};

const LONG_PRESS_MS = 550;
const SUGGEST_PAGE_SIZE = 8;

interface Row {
  id: number;
  food: Food; // カードで確定済みの食品。一覧に乗る行は常に確定済み
  usedWeight: string; // 使用量(g)＝料理で使う可食部の重さ。栄養計算もこの値をそのまま使う。
}

let nextRowId = 1;

export default function Worksheet({
  menuId,
  onBack,
}: {
  menuId: string | null;
  onBack: () => void;
}) {
  const stableIdRef = useRef<string>(menuId ?? createMenuId());
  const createdAtRef = useRef<number>(Date.now());
  const defaultTitleRef = useRef<string | null>(null);
  // 既存献立として一度でも保存されたか。true になった後は材料0件になっても
  // （全消し＝更新）保存し続けないと、一覧に古い内容が残ったままになってしまう。
  const everSavedRef = useRef<boolean>(false);

  const [foods, setFoods] = useState<Food[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [exportMode, setExportMode] = useState(false);
  const [menuTitle, setMenuTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // --- 入力カード（常時1枚固定表示） ---
  const [addQuery, setAddQuery] = useState("");
  const [addFood, setAddFood] = useState<Food | null>(null);
  const [addWeight, setAddWeight] = useState("");
  const [addSearchOpen, setAddSearchOpen] = useState(false);
  const [suggestLimit, setSuggestLimit] = useState(SUGGEST_PAGE_SIZE);
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // 候補一覧の矢印キー操作用
  const weightInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    loadFoods().then(setFoods);
  }, []);

  // 既存献立の読み込み（成分表のロード完了後に、食品コード→Foodを解決してから行を復元する）
  useEffect(() => {
    if (!foods) return;
    let cancelled = false;
    (async () => {
      if (menuId) {
        const stored = await getMenu(menuId);
        if (!cancelled && stored) {
          createdAtRef.current = stored.createdAt;
          everSavedRef.current = true;
          setMenuTitle(stored.title);
          const restored: Row[] = [];
          for (const r of stored.rows) {
            const food = findByCode(foods, r.code);
            if (food) restored.push({ id: nextRowId++, food, usedWeight: r.usedWeight });
          }
          setRows(restored);
        }
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foods]);

  // 自動保存: 材料の追加・削除・使用量変更・献立名変更のたびに保存する。
  // 新規献立は材料が1件も無い間は保存しない（空の下書きで一覧が汚れないように）。
  // 既存献立を全部消して0件にした場合は、空のまま残すと一覧に古い内容が残って見えるのを
  // 避けるため、一覧からも削除する（また材料を足せば新規保存として扱われる）。
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      if (rows.length === 0) {
        if (everSavedRef.current) {
          await deleteMenu(stableIdRef.current);
          everSavedRef.current = false;
        }
        return;
      }
      let title = menuTitle.trim();
      if (!title) {
        if (!defaultTitleRef.current) {
          defaultTitleRef.current = await nextDefaultTitle();
        }
        title = defaultTitleRef.current;
        if (!cancelled) setMenuTitle(title);
      }
      const stored: StoredMenu = {
        id: stableIdRef.current,
        title,
        rows: rows.map((r) => ({ code: r.food.code, usedWeight: r.usedWeight })),
        createdAt: createdAtRef.current,
        updatedAt: Date.now(),
      };
      await upsertMenu(stored);
      everSavedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, menuTitle, loaded]);

  useEffect(() => {
    setSuggestLimit(SUGGEST_PAGE_SIZE);
    setHighlightedIndex(-1);
  }, [addQuery, addFood]);

  const allSuggestions = useMemo(() => {
    if (!foods || addFood || !addQuery) return [];
    return searchFoods(foods, addQuery);
  }, [foods, addFood, addQuery]);
  const suggestions = allSuggestions.slice(0, suggestLimit);
  const hasMoreSuggestions = allSuggestions.length > suggestions.length;

  function pickAddFood(food: Food) {
    setAddFood(food);
    setAddQuery(food.name);
    setAddSearchOpen(false);
    setHighlightedIndex(-1);
    weightInputRef.current?.focus();
  }

  function handleAddNameBlur() {
    window.setTimeout(() => setAddSearchOpen(false), 150);
  }

  // 候補一覧の矢印キー操作（↓/↑で移動、Enterで確定、Escで閉じる）
  function handleNameKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (!addSearchOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        pickAddFood(suggestions[highlightedIndex].food);
      } else if (suggestions.length === 1) {
        e.preventDefault();
        pickAddFood(suggestions[0].food);
      }
    } else if (e.key === "Escape") {
      setAddSearchOpen(false);
    }
  }

  const canCommitAdd = !!addFood && isValidWeightNumber(addWeight);

  function commitAdd() {
    if (!addFood || !isValidWeightNumber(addWeight)) return;
    setRows((rs) => [...rs, { id: nextRowId++, food: addFood, usedWeight: addWeight }]);
    setAddFood(null);
    setAddQuery("");
    setAddWeight("");
    nameInputRef.current?.focus();
  }

  function setRowWeight(id: number, value: string) {
    const normalized = normalizeWeightInput(value);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, usedWeight: normalized } : r)));
  }

  function removeRow(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleRowPointerDown(e: ReactPointerEvent<HTMLTableRowElement>, id: number) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      setConfirmDeleteId(id);
    }, LONG_PRESS_MS);
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* noop */
    }
  }

  const nutrientRows: NutrientRow[] = rows.map((r) => computeRow(r.food, weightValue(r.usedWeight)));
  const subtotal = sumRows(nutrientRows);
  const totalWeight = round1(rows.reduce((acc, r) => acc + weightValue(r.usedWeight), 0));

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="back-btn" onClick={onBack} aria-label="一覧に戻る">
          ←
        </button>
        {exportMode ? (
          <span className="menu-title-view">{menuTitle || "（献立名未入力）"}</span>
        ) : (
          <span
            className="menu-title-input"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setMenuTitle(e.currentTarget.textContent || "")}
          >
            {menuTitle || "（献立名を入力）"}
          </span>
        )}
        <button type="button" className="mode-toggle" onClick={() => setExportMode((v) => !v)}>
          {exportMode ? "編集に戻る" : "画像用表示"}
        </button>
      </header>

      {exportMode ? (
        <ExportView
          rows={rows}
          nutrientRows={nutrientRows}
          subtotal={subtotal}
          totalWeight={totalWeight}
          menuTitle={menuTitle}
        />
      ) : (
        <>
          {/* --- 入力カード --- */}
          <div className="add-card">
            <div className="add-card-row add-card-name">
              <input
                ref={nameInputRef}
                value={addQuery}
                placeholder="食品名 / 番号 / ローマ字（例: shio）"
                onFocus={() => setAddSearchOpen(true)}
                onBlur={handleAddNameBlur}
                onKeyDown={handleNameKeyDown}
                role="combobox"
                aria-expanded={addSearchOpen && suggestions.length > 0}
                aria-autocomplete="list"
                onChange={(e) => {
                  setAddQuery(e.target.value);
                  setAddFood(null);
                  setAddSearchOpen(true);
                }}
              />
              {addSearchOpen && suggestions.length > 0 && (
                <ul className="suggestions add-card-suggestions" role="listbox">
                  {suggestions.map((s, i) => (
                    <li
                      key={s.food.code}
                      role="option"
                      aria-selected={i === highlightedIndex}
                      className={i === highlightedIndex ? "active" : undefined}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onMouseDown={() => pickAddFood(s.food)}
                    >
                      <span className="s-code">{s.food.code}</span>
                      <span className="s-name">{s.food.name}</span>
                      {cellValue(s.food.waste_pct) ? (
                        <span className="s-waste">廃棄目安 {cellValue(s.food.waste_pct)}%</span>
                      ) : null}
                    </li>
                  ))}
                  {hasMoreSuggestions && (
                    <li className="suggestions-more">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setSuggestLimit((n) => n + SUGGEST_PAGE_SIZE)}
                      >
                        候補をもっと見る（残り{allSuggestions.length - suggestions.length}件）
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="add-card-row add-card-weight">
              <div className="add-card-weight-field">
                <input
                  ref={weightInputRef}
                  className={`num${weightHasWarning(addWeight) ? " invalid" : ""}`}
                  value={addWeight}
                  placeholder="使用量(g)"
                  inputMode="decimal"
                  onChange={(e) => setAddWeight(normalizeWeightInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitAdd();
                  }}
                />
                {weightWarningMessage(addWeight) && (
                  <span className="weight-warning">{weightWarningMessage(addWeight)}</span>
                )}
              </div>
              <button type="button" className="add-card-btn" disabled={!canCommitAdd} onClick={commitAdd}>
                材料を追加
              </button>
            </div>
          </div>

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
                        {COLUMN_LABELS[k][0]}
                        <br />({COLUMN_LABELS[k][1]})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const computed = nutrientRows[i];
                    // 確定済みの行で使用量が空欄なのは「入力し忘れ」なので、
                    // 数字バリデーションの警告（weightHasWarning）とは別に必ず警告表示する。
                    const isBlank = row.usedWeight.trim() === "";
                    const warn = isBlank || weightHasWarning(row.usedWeight);
                    const warnMsg = isBlank ? "使用量が未入力です（0として計算中）" : weightWarningMessage(row.usedWeight);
                    return (
                      <Fragment key={row.id}>
                        <tr
                          onPointerDown={(e) => handleRowPointerDown(e, row.id)}
                          onPointerUp={clearLongPressTimer}
                          onPointerCancel={clearLongPressTimer}
                          onPointerLeave={clearLongPressTimer}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          <td className="col-del">
                            <button
                              type="button"
                              className="row-del-btn"
                              aria-label={`「${row.food.name}」を削除`}
                              onClick={() => setConfirmDeleteId(row.id)}
                            >
                              ×
                            </button>
                          </td>
                          <td className="col-name">{row.food.name}</td>
                          <td className="col-weight">
                            <input
                              className={`num${warn ? " invalid" : ""}`}
                              value={row.usedWeight}
                              inputMode="decimal"
                              onChange={(e) => setRowWeight(row.id, e.target.value)}
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
                  <tr className="subtotal">
                    <td className="col-del"></td>
                    <td className="col-name">小計</td>
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

          <p className="note">
            八訂（増補2023）ベース・小数第1位で丸め。使用量＝実際に料理で使う可食部の重さとして計算します。行の削除は「×」または一覧の行を長押しで確認ポップアップが出ます。入力内容は自動的に保存されます。
          </p>
        </>
      )}

      {confirmDeleteId !== null &&
        (() => {
          const target = rows.find((r) => r.id === confirmDeleteId);
          if (!target) return null;
          return (
            <div className="confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
              <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-title">「{target.food.name}」を削除しますか？</div>
                <div className="confirm-actions">
                  <button type="button" className="confirm-cancel" onClick={() => setConfirmDeleteId(null)}>
                    キャンセル
                  </button>
                  <button
                    type="button"
                    className="confirm-delete"
                    onClick={() => {
                      removeRow(target.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    削除する
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// 画像用表示（画面表示）／提出用エクスポート。どちらも同じ、入力用の表とほぼ同じ見た目の
// 「栄養価計算用紙」形式の表で統一する（先生に提出できる体裁＝スクリーンショットでそのままLINE/メール共有できる形）。
function ExportView({
  rows,
  nutrientRows,
  subtotal,
  totalWeight,
  menuTitle,
}: {
  rows: Row[];
  nutrientRows: NutrientRow[];
  subtotal: NutrientRow;
  totalWeight: number;
  menuTitle: string;
}) {
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="export-view">
      <div className="export-head">
        <div className="export-title">{menuTitle || "（献立名未入力）"}</div>
        <div className="export-date">{today} 作成・栄養計算アプリ</div>
      </div>

      {rows.length === 0 ? (
        <p className="note">材料が入力されていません。</p>
      ) : (
        <div className="sheet export-sheet">
          <div className="sheet-scroll">
            <table className="sheet-table export-table">
              <thead>
                <tr>
                  <th className="col-name">材料名</th>
                  <th className="col-weight">
                    使用量
                    <br />
                    (g)
                  </th>
                  {NUTRIENT_KEYS.map((k) => (
                    <th key={k}>
                      {COLUMN_LABELS[k][0]}
                      <br />({COLUMN_LABELS[k][1]})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const computed = nutrientRows[i];
                  return (
                    <tr key={row.id}>
                      <td className="col-name">{row.food.name}</td>
                      <td className="col-weight num">{row.usedWeight || 0}</td>
                      {NUTRIENT_KEYS.map((k) => (
                        <td key={k} className="num">
                          {computed[k]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="subtotal">
                  <td className="col-name">小計</td>
                  <td className="col-weight num">{totalWeight || ""}</td>
                  {NUTRIENT_KEYS.map((k) => (
                    <td key={k} className="num">
                      {subtotal[k]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="note">
        八訂（増補2023）ベースの計算上の目安です。スクリーンショットして提出・共有にご利用ください。
      </p>
    </div>
  );
}
