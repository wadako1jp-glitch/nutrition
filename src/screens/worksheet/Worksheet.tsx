// 入力画面（1つの献立の材料表）。この画面の「まとめ役」で、部品は同じフォルダにある:
//   AddCard.tsx             材料追加欄（食品の検索・使用量・料理タグ）
//   SheetTable.tsx          材料表（行ごとの栄養価・タグごとの小計・献立の小計）
//   DeleteConfirmDialog.tsx 行を消す前の確認
//   ExportView.tsx          画像用表示（提出・共有用）
//   useWideChrome.ts        横持ち（ワイド表示）でツールバーを隠す仕組み
// 発注量の表示は src/features/order-quantity/OrderView.tsx。
// このファイルがするのは、献立の読み込みと自動保存、材料の追加・変更・削除、表示の切り替え。
// 材料表・発注量・画像用表示のどれを出すか（mode）はURLで決まる（src/lib/route.ts）。スマホの「戻る」で1つ前の表示に戻る。
import { useEffect, useRef, useState } from "react";
import { Dish, ensureDish, pruneUnusedDishes } from "../../core/dishes";
import { MEALS, Meal, guessMeal, menuDateStamp, menuTitle as buildMenuTitle } from "../../core/menuTitle";
import { NutrientRow, computeRow, round1, sumRows } from "../../core/nutrition";
import { normalizeWeightInput, weightValue } from "../../core/weightInput";
import { CURRENT_FOOD_TABLE } from "../../data/foodTable";
import { Food, findByCode, loadFoods } from "../../data/foods";
import OrderView from "../../features/order-quantity/OrderView";
import type { WorksheetMode } from "../../lib/route";
import { StoredMenu, StoredMenuRow, deleteMenu, getMenu, upsertMenu } from "../../lib/storage/menus";
import { getSettings, saveSettings } from "../../lib/storage/settings";
import AddCard, { AddDraft, EMPTY_ADD_DRAFT } from "./AddCard";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import { resolveDishSelection } from "./DishSelect";
import ExportView from "./ExportView";
import { Row, newRowId } from "./rows";
import SheetTable from "./SheetTable";
import { useWideChrome } from "./useWideChrome";

export default function Worksheet({
  menuId,
  isNew,
  mode,
  onModeChange,
  onModeClose,
  onBack,
}: {
  menuId: string; // 開く献立（新しい献立も、作った時点でIDを決めてある）
  isNew: boolean; // 「新しい献立」から開いた（まだ保存されていない）
  mode: WorksheetMode; // 材料表 / 発注量 / 画像用表示
  onModeChange: (mode: WorksheetMode) => void; // 発注量・画像用表示を開く
  onModeClose: () => void; // 発注量・画像用表示を閉じて1つ前の表示に戻る
  onBack: () => void; // 献立一覧に戻る
}) {
  const stableIdRef = useRef<string>(menuId);
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
  const [dishes, setDishes] = useState<Dish[]>([]); // 料理タグ（選んだ時点で作られ、使われなくなったら消える）
  const exportMode = mode === "image"; // 画像用表示
  const orderMode = mode === "order"; // 発注量の表示（材料表の代わりに出す）
  const [servings, setServings] = useState(1); // 発注量の人数
  // 献立名は「yyyymmdd_朝食」固定形式。日付は作成日、区分だけプルダウンで選ぶ（新規は時刻から推定）
  const [meal, setMeal] = useState<Meal | null>(() => (isNew ? guessMeal(createdAtRef.current) : null));
  const [legacyTitle, setLegacyTitle] = useState(""); // 旧版で自由入力された献立名（区分を選ぶまでそのまま使う）
  const menuTitle = meal ? buildMenuTitle(createdAtRef.current, meal) : legacyTitle;
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null); // 削除を確認中の行
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false); // 設定: 材料を確認なしで連続削除
  const [loaded, setLoaded] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>(EMPTY_ADD_DRAFT); // 材料追加欄の入力途中の内容
  const { chromeShown, showChrome, handlePageClick, topbarRef, addCardRef } = useWideChrome();

  useEffect(() => {
    loadFoods().then(setFoods);
    getSettings().then((s) => setSkipDeleteConfirm(s.skipRowDeleteConfirm));
  }, []);

  // 既存献立の読み込み（成分表のロード完了後に、食品番号→食品を引き当ててから行を復元する）
  useEffect(() => {
    if (!foods) return;
    let cancelled = false;
    (async () => {
      const stored = await getMenu(menuId);
      if (cancelled) return;
      if (stored) {
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
          if (food) restored.push({ id: newRowId(), food, usedWeight: r.usedWeight, dishId: r.dishId });
          else unresolved.push(r);
        }
        setRows(restored);
        setUnresolvedRows(unresolved);
      } else if (!isNew) {
        // 保存前の新しい献立をURLから開き直した場合など、見つからなければ新しい献立として始める
        setMeal(guessMeal(createdAtRef.current));
      }
      setLoaded(true);
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
        rows: [...rows.map((r) => ({ code: r.food.code, usedWeight: r.usedWeight, dishId: r.dishId })), ...unresolvedRows],
        createdAt: createdAtRef.current,
        updatedAt: Date.now(),
      };
      await upsertMenu(stored);
      everSavedRef.current = true;
    })().catch(() => {}); // 保存の失敗は画面下の注意（SaveErrorBanner）で知らせる。次の変更でまた保存を試みる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, dishes, menuTitle, servings, loaded]);

  // --- 材料の追加・変更・削除 ---

  function addRow(food: Food, usedWeight: string, dishName: string | null) {
    let dishId: string | null = null;
    if (dishName) {
      const ensured = ensureDish(dishes, dishName);
      if (ensured.ok) {
        setDishes(ensured.dishes);
        dishId = ensured.id;
      }
    }
    setRows((rs) => [...rs, { id: newRowId(), food, usedWeight, dishId }]);
  }

  function setRowWeight(id: number, value: string) {
    const normalized = normalizeWeightInput(value);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, usedWeight: normalized } : r)));
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

  function removeRow(id: number) {
    const nextRows = rows.filter((r) => r.id !== id);
    setRows(nextRows);
    setDishes(pruneUnusedDishes(dishes, [...nextRows, ...unresolvedRows]));
  }

  // 「×」を押したとき。設定で確認を省略していれば、確認せずに消す
  function requestDeleteRow(id: number) {
    if (skipDeleteConfirm) removeRow(id);
    else setConfirmDeleteId(id);
  }

  // --- 表示 ---

  const nutrientRows: NutrientRow[] = rows.map((r) => computeRow(r.food, weightValue(r.usedWeight)));
  const subtotal = sumRows(nutrientRows);
  const totalWeight = round1(rows.reduce((acc, r) => acc + weightValue(r.usedWeight), 0));
  const deleting = confirmDeleteId !== null ? rows.find((r) => r.id === confirmDeleteId) : undefined;

  return (
    <div className={`page worksheet-page${chromeShown ? " chrome-shown" : ""}`} onClick={handlePageClick}>
      <button type="button" className="wide-reveal" onClick={showChrome}>
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
          <button type="button" className="mode-toggle" onClick={() => onModeChange("order")}>
            発注量
          </button>
        )}
        <button type="button" className="mode-toggle" onClick={() => (exportMode ? onModeClose() : onModeChange("image"))}>
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
          onClose={onModeClose}
        />
      ) : orderMode ? (
        <OrderView rows={rows} dishes={dishes} servings={servings} onServingsChange={setServings} onClose={onModeClose} />
      ) : (
        <>
          <AddCard foods={foods} dishes={dishes} cardRef={addCardRef} draft={addDraft} onDraftChange={setAddDraft} onAdd={addRow} />

          {unresolvedRows.length > 0 && (
            <p className="note unresolved-note">
              現在の成分表「{CURRENT_FOOD_TABLE.label}」に見つからない食品が{unresolvedRows.length}件あるため、表に表示していません（食品番号:{" "}
              {unresolvedRows.map((r) => r.code).join("、")}）。献立データには残っています。
            </p>
          )}
          <SheetTable
            rows={rows}
            dishes={dishes}
            nutrientRows={nutrientRows}
            subtotal={subtotal}
            totalWeight={totalWeight}
            onDeleteRequest={requestDeleteRow}
            onWeightChange={setRowWeight}
            onDishChange={setRowDish}
          />

          <p className="note">
            {CURRENT_FOOD_TABLE.label}ベース・小数第1位で丸め。使用量＝実際に料理で使う可食部の重さとして計算します。行の削除は「×」で確認ポップアップが出ます。入力内容は自動的に保存されます。端末を横にする（画面幅が広い）と全項目を1画面に表示し、画面のタップでツールバー・材料追加を表示／非表示します。
          </p>
        </>
      )}

      {deleting && (
        <DeleteConfirmDialog
          foodName={deleting.food.name}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={(skipNextTime) => {
            removeRow(deleting.id);
            setConfirmDeleteId(null);
            if (skipNextTime) {
              setSkipDeleteConfirm(true);
              saveSettings({ skipRowDeleteConfirm: true }).catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}
