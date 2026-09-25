import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Dish,
  RowGroup,
  dishOptionNames,
  dishTint,
  ensureDish,
  groupRowsByDish,
  pruneUnusedDishes,
} from "../core/dishes";
import {
  Food,
  cellValue,
  findByCode,
  loadFoods,
  searchFoods,
} from "../data/foods";
import { NUTRIENT_KEYS, NUTRIENT_LABELS, NutrientRow, computeRow, round1, sumRows } from "../core/nutrition";
import {
  isValidWeightNumber,
  normalizeWeightInput,
  weightHasWarning,
  weightValue,
  weightWarningMessage,
} from "../core/weightInput";
import { StoredMenu, StoredMenuRow, createMenuId, deleteMenu, getMenu, upsertMenu } from "../lib/storage/menus";
import { CURRENT_FOOD_TABLE } from "../data/foodTable";
import OrderView from "../features/order-quantity/OrderView";
import { buildExportSheet } from "../features/export-image/exportSheet";
import { exportSheetToPng } from "../features/export-image/drawExportSheet";
import { MEALS, Meal, guessMeal, menuDateStamp, menuTitle as buildMenuTitle } from "../core/menuTitle";
import { getSettings, saveSettings } from "../lib/storage/settings";
import { WIDE_QUERY, useMediaQuery } from "../hooks/useMediaQuery";

const COLUMN_LABELS = NUTRIENT_LABELS;

const SUGGEST_PAGE_SIZE = 8;
// ワイド表示でツールバー・材料追加欄を自動で隠すまでの時間
const WIDE_CHROME_HIDE_MS = 4000;

interface Row {
  id: number;
  food: Food; // カードで確定済みの食品。一覧に乗る行は常に確定済み
  usedWeight: string; // 使用量(g)＝料理で使う可食部の重さ。栄養計算もこの値をそのまま使う。
  dishId: string | null; // 料理タグ。null = 未割当
}

const CUSTOM_DISH = "__custom__";

// 料理タグのプルダウン（材料追加欄と各材料行で共通）。プリセット＋この献立で作った自由入力タグ。
function DishSelect({
  dishes,
  value,
  emptyLabel,
  className,
  style,
  ariaLabel,
  onChange,
}: {
  dishes: Dish[];
  value: string | null; // タグ名
  emptyLabel: string;
  className: string;
  style?: CSSProperties;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const names = dishOptionNames(dishes);
  if (value && !names.includes(value)) names.push(value); // 引き継ぎ中の自由入力タグ
  return (
    <select className={className} style={style} aria-label={ariaLabel} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {names.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
      <option value={CUSTOM_DISH}>＋自由入力…</option>
    </select>
  );
}

// 行の淡いハイライト色をCSS変数で渡す（sticky列も同じ色で塗るため）
function tintStyle(tint: string | undefined): CSSProperties | undefined {
  return tint ? ({ "--row-bg": tint } as CSSProperties) : undefined;
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
  // 既存献立として一度でも保存されたか。true になった後は材料0件になっても
  // （全消し＝更新）保存し続けないと、一覧に古い内容が残ったままになってしまう。
  const everSavedRef = useRef<boolean>(false);
  // 献立を作成したときの成分表の版。開き直して保存しても書き換えない（改訂版への移行時に判別するため）
  const foodTableRef = useRef<string>(CURRENT_FOOD_TABLE.id);
  // 今の成分表に食品番号が見つからなかった行（版の切り替え後に起こり得る）。
  // 表には出せないが、保存時にそのまま書き戻して献立データからは消さない
  const [unresolvedRows, setUnresolvedRows] = useState<StoredMenuRow[]>([]);

  const [foods, setFoods] = useState<Food[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [exportMode, setExportMode] = useState(false);
  const [orderMode, setOrderMode] = useState(false); // 発注量の表示（材料表の代わりに出す）
  const [servings, setServings] = useState(1); // 発注量の人数
  // 献立名は「yyyymmdd_朝食」固定形式。日付は作成日、区分だけプルダウンで選ぶ（新規は時刻から推定）
  const [meal, setMeal] = useState<Meal | null>(() => (menuId ? null : guessMeal(createdAtRef.current)));
  const [legacyTitle, setLegacyTitle] = useState(""); // 旧版で自由入力された献立名（区分を選ぶまでそのまま使う）
  const menuTitle = meal ? buildMenuTitle(createdAtRef.current, meal) : legacyTitle;
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false); // 設定: 材料を確認なしで連続削除
  const [dontAskAgain, setDontAskAgain] = useState(false); // 削除確認の「次から確認しない」チェック
  const [loaded, setLoaded] = useState(false);

  // --- 料理タグ（プルダウンで選んだ時点で作られ、使われなくなったら消える） ---
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [addDishName, setAddDishName] = useState<string | null>(null); // 次に追加する材料のタグ（直前の選択を引き継ぐ）

  // --- 入力カード（常時1枚固定表示） ---
  const [addQuery, setAddQuery] = useState("");
  const [addFood, setAddFood] = useState<Food | null>(null);
  const [addWeight, setAddWeight] = useState("");
  const [addSearchOpen, setAddSearchOpen] = useState(false);
  const [suggestLimit, setSuggestLimit] = useState(SUGGEST_PAGE_SIZE);
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // 候補一覧の矢印キー操作用
  const weightInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // --- ワイド表示（変更仕様004） ---
  // 表の列・レイアウトの切り替えは styles.css のメディアクエリだけで行う。ここでは
  // ツールバー・材料追加欄を隠すかどうかのクラスを付け外しするだけで、DOMの構造は変えない
  // （狭い版/広い版の表を出し分けると input が再マウントされ、入力値・フォーカス・IMEの変換中文字が消えるため）。
  // 入力中の欄を含むツールバー・材料追加欄は :focus-within により隠れない（CSS側）。
  const wide = useMediaQuery(WIDE_QUERY);
  const [chromeShown, setChromeShown] = useState(true);
  const topbarRef = useRef<HTMLElement>(null);
  const addCardRef = useRef<HTMLDivElement>(null);

  // ワイド表示に入ったら一度見せてから隠す（画像用表示の操作ボタンと同じ挙動）
  useEffect(() => {
    if (wide) setChromeShown(true);
  }, [wide]);

  useEffect(() => {
    if (!wide || !chromeShown) return;
    let timer = 0;
    const arm = () => {
      timer = window.setTimeout(() => {
        const active = document.activeElement;
        // 入力・選択の最中は隠さずに待つ
        if (active && (topbarRef.current?.contains(active) || addCardRef.current?.contains(active))) arm();
        else setChromeShown(false);
      }, WIDE_CHROME_HIDE_MS);
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [wide, chromeShown]);

  // ワイド表示中、表の余白や数値セルのタップでツールバー・材料追加欄を表示／非表示
  function handlePageClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!wide) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, label, a, .topbar, .add-card, .confirm-overlay, .export-overlay, .order-view")) return;
    setChromeShown((v) => !v);
  }

  useEffect(() => {
    loadFoods().then(setFoods);
    getSettings().then((s) => setSkipDeleteConfirm(s.skipRowDeleteConfirm));
  }, []);

  // ×ボタンからの削除要求。設定で確認を省略していれば即削除する
  function requestDeleteRow(id: number) {
    if (skipDeleteConfirm) {
      removeRow(id);
      return;
    }
    setDontAskAgain(false);
    setConfirmDeleteId(id);
  }

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
          setMeal(stored.meal);
          setLegacyTitle(stored.title);
          foodTableRef.current = stored.foodTable;
          setServings(stored.servings);
          setDishes(stored.dishes);
          const restored: Row[] = [];
          const unresolved: StoredMenuRow[] = [];
          for (const r of stored.rows) {
            const food = findByCode(foods, r.code);
            if (food) restored.push({ id: nextRowId++, food, usedWeight: r.usedWeight, dishId: r.dishId });
            else unresolved.push(r);
          }
          setRows(restored);
          setUnresolvedRows(unresolved);
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
      if (rows.length === 0 && unresolvedRows.length === 0) {
        if (everSavedRef.current) {
          await deleteMenu(stableIdRef.current);
          everSavedRef.current = false;
        }
        return;
      }
      const stored: StoredMenu = {
        id: stableIdRef.current,
        title: menuTitle || buildMenuTitle(createdAtRef.current, guessMeal(createdAtRef.current)),
        meal,
        foodTable: foodTableRef.current,
        servings,
        dishes,
        rows: [
          ...rows.map((r) => ({ code: r.food.code, usedWeight: r.usedWeight, dishId: r.dishId })),
          ...unresolvedRows,
        ],
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
  }, [rows, dishes, menuTitle, servings, loaded]);

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

  // 候補のタップが blur より後に届くよう、閉じるのを少し遅らせる。遅らせている間に欄へ戻って
  // 打ち始めた場合は閉じない（素早く次の食品を打つと候補が出ないことがあったため）
  const blurCloseTimerRef = useRef<number | null>(null);
  function cancelBlurClose() {
    if (blurCloseTimerRef.current !== null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  }
  function handleAddNameBlur() {
    cancelBlurClose();
    blurCloseTimerRef.current = window.setTimeout(() => {
      blurCloseTimerRef.current = null;
      setAddSearchOpen(false);
    }, 150);
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
    let dishId: string | null = null;
    if (addDishName) {
      const ensured = ensureDish(dishes, addDishName);
      if (ensured.ok) {
        setDishes(ensured.dishes);
        dishId = ensured.id;
      }
    }
    setRows((rs) => [...rs, { id: nextRowId++, food: addFood, usedWeight: addWeight, dishId }]);
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
    const nextRows = rows.filter((r) => r.id !== id);
    setRows(nextRows);
    setDishes(pruneUnusedDishes(dishes, [...nextRows, ...unresolvedRows]));
  }

  // プルダウンの「＋自由入力…」。キャンセル・空欄なら null
  function promptCustomDishName(): string | null {
    const name = window.prompt("料理タグ名を入力（例：小鉢、飲み物）")?.trim();
    return name ? name : null;
  }

  // タグのプルダウンの値（"" = タグなし、CUSTOM_DISH = 自由入力）をタグ名に解決する。undefined = 変更しない
  function resolveDishSelection(value: string): string | null | undefined {
    if (value === "") return null;
    if (value === CUSTOM_DISH) return promptCustomDishName() ?? undefined;
    return value;
  }

  function setRowDish(rowId: number, value: string) {
    const name = resolveDishSelection(value);
    if (name === undefined) return;
    let nextDishes = dishes;
    let dishId: string | null = null;
    if (name !== null) {
      const ensured = ensureDish(dishes, name);
      if (!ensured.ok) return;
      nextDishes = ensured.dishes;
      dishId = ensured.id;
    }
    const nextRows = rows.map((r) => (r.id === rowId ? { ...r, dishId } : r));
    setRows(nextRows);
    setDishes(pruneUnusedDishes(nextDishes, [...nextRows, ...unresolvedRows]));
  }

  function setAddDish(value: string) {
    const name = resolveDishSelection(value);
    if (name !== undefined) setAddDishName(name);
  }

  const nutrientRows: NutrientRow[] = rows.map((r) => computeRow(r.food, weightValue(r.usedWeight)));
  const subtotal = sumRows(nutrientRows);
  const totalWeight = round1(rows.reduce((acc, r) => acc + weightValue(r.usedWeight), 0));
  const groups = groupRowsByDish(rows, dishes);
  return (
    <div className={`page worksheet-page${chromeShown ? " chrome-shown" : ""}`} onClick={handlePageClick}>
      <button type="button" className="wide-reveal" onClick={() => setChromeShown(true)}>
        ▼ ツールバー・材料追加を表示（画面タップでも表示／非表示）
      </button>
      <header className="topbar" ref={topbarRef}>
        <button type="button" className="back-btn" onClick={onBack} aria-label="一覧に戻る">
          ←
        </button>
        {/* 献立名: 日付（作成日）は固定表示、区分だけ選ぶ */}
        <span className="menu-title-input" title={menuTitle}>
          <span className="menu-title-date">{menuDateStamp(createdAtRef.current)}_</span>
          <select
            className="menu-title-meal"
            aria-label="献立名の食事区分"
            value={meal ?? ""}
            onChange={(e) => setMeal((e.target.value || null) as Meal | null)}
          >
            {meal === null && <option value="">{legacyTitle ? `（旧: ${legacyTitle}）` : "区分を選択"}</option>}
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </span>
        {!orderMode && (
          <button type="button" className="mode-toggle" onClick={() => setOrderMode(true)}>
            発注量
          </button>
        )}
        <button type="button" className="mode-toggle" onClick={() => setExportMode((v) => !v)}>
          {exportMode ? "編集に戻る" : "画像用表示"}
        </button>
      </header>

      {exportMode ? (
        <ExportView
          rows={rows}
          dishes={dishes}
          nutrientRows={nutrientRows}
          subtotal={subtotal}
          totalWeight={totalWeight}
          menuTitle={menuTitle}
          onClose={() => setExportMode(false)}
        />
      ) : orderMode ? (
        <OrderView
          rows={rows}
          dishes={dishes}
          servings={servings}
          onServingsChange={setServings}
          onClose={() => setOrderMode(false)}
        />
      ) : (
        <>
          {/* --- 入力カード --- */}
          <div className="add-card" ref={addCardRef}>
            <div className="add-card-row add-card-name">
              <input
                ref={nameInputRef}
                value={addQuery}
                placeholder="食品名 / 番号 / ローマ字（例: shio）"
                onFocus={() => {
                  cancelBlurClose();
                  setAddSearchOpen(true);
                }}
                onBlur={handleAddNameBlur}
                onKeyDown={handleNameKeyDown}
                role="combobox"
                aria-expanded={addSearchOpen && suggestions.length > 0}
                aria-autocomplete="list"
                onChange={(e) => {
                  cancelBlurClose();
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
              <DishSelect
                dishes={dishes}
                value={addDishName}
                emptyLabel="タグなし"
                className="add-card-dish"
                style={{ background: dishTint(dishes, dishes.find((d) => d.name === addDishName)?.id ?? null) }}
                ariaLabel="追加する材料の料理タグ"
                onChange={setAddDish}
              />
              <button type="button" className="add-card-btn" disabled={!canCommitAdd} onClick={commitAdd}>
                材料を追加
              </button>
            </div>
          </div>

          {unresolvedRows.length > 0 && (
            <p className="note unresolved-note">
              現在の成分表「{CURRENT_FOOD_TABLE.label}」に見つからない食品が{unresolvedRows.length}件あるため、表に表示していません（食品番号:{" "}
              {unresolvedRows.map((r) => r.code).join("、")}）。献立データには残っています。
            </p>
          )}
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
                  {groups.map((g) => (
                    <Fragment key={g.dish?.id ?? "unassigned"}>
                  {g.rows.map(({ row, index: i }) => {
                    const computed = nutrientRows[i];
                    // 確定済みの行で使用量が空欄なのは「入力し忘れ」なので、
                    // 数字バリデーションの警告（weightHasWarning）とは別に必ず警告表示する。
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
                              onClick={() => requestDeleteRow(row.id)}
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
                                onChange={(v) => setRowDish(row.id, v)}
                              />
                            </div>
                          </td>
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

          <p className="note">
            {CURRENT_FOOD_TABLE.label}ベース・小数第1位で丸め。使用量＝実際に料理で使う可食部の重さとして計算します。行の削除は「×」で確認ポップアップが出ます。入力内容は自動的に保存されます。端末を横にする（画面幅が広い）と全項目を1画面に表示し、画面のタップでツールバー・材料追加を表示／非表示します。
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
                <label className="confirm-skip">
                  <input type="checkbox" checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)} />
                  次から確認せずに削除する（連続で消せます。⚙の設定で元に戻せます）
                </label>
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
                      if (dontAskAgain) {
                        setSkipDeleteConfirm(true);
                        saveSettings({ skipRowDeleteConfirm: true });
                      }
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

// 料理ごとの小計行を出すか。タグを1つも作っていない献立（従来の献立）では、
// 「未割当 小計」が献立小計と全く同じ行になるだけなので出さない。
function showGroupSubtotal(g: RowGroup<Row>, dishes: Dish[]): boolean {
  return g.dish !== null || dishes.length > 0;
}

// 料理タグごとの小計行（既存の献立小計と同じ14項目）
function GroupSubtotalRow({
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

// Web Share API で画像ファイルを共有できるか（iOS Safari 15+・Android Chrome 等）
function canShareImageFiles(): boolean {
  try {
    const probe = new File([""], "probe.png", { type: "image/png" });
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// 画像用表示の拡大上限（材料が少ないときに文字が巨大になりすぎないように）
const EXPORT_MAX_SCALE = 3;
const EXPORT_CONTROLS_HIDE_MS = 2500;

interface ExportLayout {
  w: number; // 横長ステージの幅（回転後の見た目基準）
  h: number;
  rotated: boolean; // 縦持ちのとき中身を90°回して横長で見せる
  scale: number;
  cw: number; // 表示内容の素の大きさ
  ch: number;
}

// 画像用表示：入力用の表と同じ「栄養価計算用紙」形式の表を、横長・全画面・スクロール無しで1画面に収める。
// 端末の表示領域を測って縮尺を決めるので、スクリーンショット1枚で献立全体が写る。
// 縦持ちなら中身を90°回転して横長にする（iPhoneは向きの固定・全画面APIが使えないため）。
function ExportView({
  rows,
  dishes,
  nutrientRows,
  subtotal,
  totalWeight,
  menuTitle,
  onClose,
}: {
  rows: Row[];
  dishes: Dish[];
  nutrientRows: NutrientRow[];
  subtotal: NutrientRow;
  totalWeight: number;
  menuTitle: string;
  onClose: () => void;
}) {
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const subtitle = `${today} 作成・栄養計算アプリ（${CURRENT_FOOD_TABLE.shortLabel}・計算上の目安）`;
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ExportLayout | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  // 全画面化・横向き固定（対応端末のみ。Android Chrome等）。非対応でも回転表示で横長になる。
  useEffect(() => {
    const el = document.documentElement;
    (async () => {
      try {
        if (el.requestFullscreen && !document.fullscreenElement) await el.requestFullscreen({ navigationUI: "hide" });
      } catch {
        /* 非対応・拒否は無視 */
      }
      try {
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
      } catch {
        /* 非対応・拒否は無視 */
      }
    })();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      try {
        screen.orientation?.unlock?.();
      } catch {
        /* noop */
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 表示領域と内容の大きさを測って、回転の要否と縮尺を決める
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const update = () => {
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const rotated = fh > fw;
      const w = rotated ? fh : fw;
      const h = rotated ? fw : fh;
      const cw = content.offsetWidth;
      const ch = content.offsetHeight;
      if (!w || !h || !cw || !ch) return;
      setLayout({ w, h, rotated, cw, ch, scale: Math.min(w / cw, h / ch, EXPORT_MAX_SCALE) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  // 共有用の画像を表示と同時に作っておく。iOS の共有シートはタップ直後にしか開けないため、
  // タップしてから画像を作ると間に合わない。画像は端末の向きに関係なく常に横長（回転なし）。
  const imageFileRef = useRef<File | null>(null);
  const [imageReady, setImageReady] = useState(false);
  useEffect(() => {
    if (!layout) return;
    let cancelled = false;
    setImageReady(false);
    // 画面の表を写し取るのではなく、同じ中身を Canvas に直接描く（src/features/export-image/）。
    // 以前の写し取り方式はスマホで数秒かかり、その間画面が固まっていた。
    const timer = window.setTimeout(async () => {
      try {
        const sheet = buildExportSheet({
          rows: rows.map((r, i) => ({ foodName: r.food.name, usedWeight: r.usedWeight, dishId: r.dishId, nutrients: nutrientRows[i] })),
          dishes,
          title: menuTitle || "（献立名未入力）",
          subtitle,
        });
        const blob = await exportSheetToPng(sheet);
        if (cancelled || !blob) return;
        imageFileRef.current = new File([blob], `${menuTitle || "献立"}.png`, { type: "image/png" });
        setImageReady(true);
      } catch {
        /* 画像化に失敗しても表示（スクショ）はそのまま使える */
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [layout?.cw, layout?.ch, menuTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  // OS標準の共有シート（iOS・Androidとも画面下から出るもの）で画像を送る。非対応ブラウザは画像を保存
  async function shareImage() {
    const file = imageFileRef.current;
    if (!file) return;
    if (canShareImageFiles()) {
      try {
        await navigator.share({ files: [file], title: menuTitle });
      } catch {
        /* ユーザーが共有シートを閉じた場合など */
      }
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 操作ボタンはスクショに写らないよう数秒で隠す（画面タップで再表示）
  useEffect(() => {
    if (!controlsVisible) return;
    const t = window.setTimeout(() => setControlsVisible(false), EXPORT_CONTROLS_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [controlsVisible]);

  return (
    <div className="export-overlay" onClick={() => setControlsVisible((v) => !v)}>
      <div className="export-frame" ref={frameRef}>
        <div
          className="export-stage"
          style={
            layout
              ? {
                  width: layout.w,
                  height: layout.h,
                  transform: `translate(-50%, -50%)${layout.rotated ? " rotate(90deg)" : ""}`,
                }
              : { visibility: "hidden" }
          }
        >
          <div
            className="export-content"
            ref={contentRef}
            style={
              layout
                ? {
                    left: (layout.w - layout.cw * layout.scale) / 2,
                    top: (layout.h - layout.ch * layout.scale) / 2,
                    transform: `scale(${layout.scale})`,
                  }
                : undefined
            }
          >
            <div className="export-head">
              <div className="export-title">{menuTitle || "（献立名未入力）"}</div>
              <div className="export-date">{subtitle}</div>
            </div>

            {rows.length === 0 ? (
              <p className="note">材料が入力されていません。</p>
            ) : (
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
                {groupRowsByDish(rows, dishes).map((g) => (
                  <Fragment key={g.dish?.id ?? "unassigned"}>
                    {g.rows.map(({ row, index: i }) => {
                      const computed = nutrientRows[i];
                      return (
                        <tr key={row.id} style={tintStyle(dishTint(dishes, row.dishId))}>
                          <td className="col-name">
                            {row.food.name}
                            {g.dish && <span className="dish-chip">{g.dish.name}</span>}
                          </td>
                          <td className="col-weight num">{row.usedWeight || 0}</td>
                          {NUTRIENT_KEYS.map((k) => (
                            <td key={k} className="num">
                              {computed[k]}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {showGroupSubtotal(g, dishes) && (
                      <GroupSubtotalRow group={g} dishes={dishes} nutrientRows={nutrientRows} withDelColumn={false} />
                    )}
                  </Fragment>
                ))}
                <tr className="subtotal">
                  <td className="col-name">{dishes.length ? "献立 小計" : "小計"}</td>
                  <td className="col-weight num">{totalWeight || ""}</td>
                  {NUTRIENT_KEYS.map((k) => (
                    <td key={k} className="num">
                      {subtotal[k]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            )}
          </div>

          <div className={`export-controls${controlsVisible ? "" : " hidden"}`}>
            <span className="export-hint">画面をタップでボタン表示／非表示</span>
            <button
              type="button"
              className="mode-toggle export-share"
              disabled={!imageReady}
              onClick={(e) => {
                e.stopPropagation();
                shareImage();
              }}
            >
              {!imageReady ? "画像を準備中…" : canShareImageFiles() ? "共有" : "画像を保存"}
            </button>
            <button
              type="button"
              className="mode-toggle"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              編集に戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
