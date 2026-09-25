// 材料追加欄（入力画面の上部に常に1枚ある）。
// 食品名を打つと候補が出て、選ぶ → 使用量を入れる → 料理タグを選ぶ →「材料を追加」で表に1行増える。
// 候補の検索そのものは src/data/foods.ts の searchFoods（表記ゆれ・ひらがな/カタカナ・食品番号に対応）。
// 入力途中の内容（AddDraft）は親の Worksheet が持つ。発注量・画像用表示に切り替えて戻っても消えないように。
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from "react";
import { Dish, dishTint } from "../../core/dishes";
import { isValidWeightNumber, normalizeWeightInput, weightHasWarning, weightWarningMessage } from "../../core/weightInput";
import { Food, cellValue, searchFoods } from "../../data/foods";
import DishSelect, { resolveDishSelection } from "./DishSelect";

const SUGGEST_PAGE_SIZE = 8; // 候補を一度に出す件数（「もっと見る」で増える）

// 材料追加欄の入力途中の内容
export interface AddDraft {
  query: string; // 食品名の欄に打った文字
  food: Food | null; // 候補から選んだ食品
  weight: string; // 使用量の欄
  dishName: string | null; // 次に追加する材料のタグ（直前の選択を引き継ぐ）
}

export const EMPTY_ADD_DRAFT: AddDraft = { query: "", food: null, weight: "", dishName: null };

export default function AddCard({
  foods,
  dishes,
  cardRef,
  draft,
  onDraftChange,
  onAdd,
}: {
  foods: Food[] | null; // 成分表（読み込み中は null）
  dishes: Dish[];
  cardRef: Ref<HTMLDivElement>; // ワイド表示で、入力中かどうかを見るため
  draft: AddDraft;
  onDraftChange: (update: (d: AddDraft) => AddDraft) => void;
  onAdd: (food: Food, usedWeight: string, dishName: string | null) => void;
}) {
  const { query, food, weight, dishName } = draft;
  const setQuery = (query: string) => onDraftChange((d) => ({ ...d, query }));
  const setFood = (food: Food | null) => onDraftChange((d) => ({ ...d, food }));
  const setWeight = (weight: string) => onDraftChange((d) => ({ ...d, weight }));
  const setDishName = (dishName: string | null) => onDraftChange((d) => ({ ...d, dishName }));
  const [searchOpen, setSearchOpen] = useState(false);
  const [suggestLimit, setSuggestLimit] = useState(SUGGEST_PAGE_SIZE);
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // 候補一覧の矢印キー操作用
  const weightInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSuggestLimit(SUGGEST_PAGE_SIZE);
    setHighlightedIndex(-1);
  }, [query, food]);

  const allSuggestions = useMemo(() => {
    if (!foods || food || !query) return [];
    return searchFoods(foods, query);
  }, [foods, food, query]);
  const suggestions = allSuggestions.slice(0, suggestLimit);
  const hasMoreSuggestions = allSuggestions.length > suggestions.length;

  function pick(f: Food) {
    setFood(f);
    setQuery(f.name);
    setSearchOpen(false);
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
  function handleNameBlur() {
    cancelBlurClose();
    blurCloseTimerRef.current = window.setTimeout(() => {
      blurCloseTimerRef.current = null;
      setSearchOpen(false);
    }, 150);
  }

  // 候補一覧の矢印キー操作（↓/↑で移動、Enterで確定、Escで閉じる）
  function handleNameKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (!searchOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        pick(suggestions[highlightedIndex].food);
      } else if (suggestions.length === 1) {
        e.preventDefault();
        pick(suggestions[0].food);
      }
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  }

  const canAdd = !!food && isValidWeightNumber(weight);

  function add() {
    if (!food || !isValidWeightNumber(weight)) return;
    onAdd(food, weight, dishName);
    setFood(null);
    setQuery("");
    setWeight("");
    nameInputRef.current?.focus();
  }

  function changeDish(value: string) {
    const name = resolveDishSelection(value);
    if (name !== undefined) setDishName(name);
  }

  return (
    <div className="add-card" ref={cardRef}>
      <div className="add-card-row add-card-name">
        <input
          ref={nameInputRef}
          value={query}
          placeholder="食品名 / 番号 / ローマ字（例: shio）"
          onFocus={() => {
            cancelBlurClose();
            setSearchOpen(true);
          }}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          role="combobox"
          aria-expanded={searchOpen && suggestions.length > 0}
          aria-autocomplete="list"
          onChange={(e) => {
            cancelBlurClose();
            setQuery(e.target.value);
            setFood(null);
            setSearchOpen(true);
          }}
        />
        {searchOpen && suggestions.length > 0 && (
          <ul className="suggestions add-card-suggestions" role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={s.food.code}
                role="option"
                aria-selected={i === highlightedIndex}
                className={i === highlightedIndex ? "active" : undefined}
                onMouseEnter={() => setHighlightedIndex(i)}
                onMouseDown={() => pick(s.food)}
              >
                <span className="s-code">{s.food.code}</span>
                <span className="s-name">{s.food.name}</span>
                {cellValue(s.food.waste_pct) ? <span className="s-waste">廃棄目安 {cellValue(s.food.waste_pct)}%</span> : null}
              </li>
            ))}
            {hasMoreSuggestions && (
              <li className="suggestions-more">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSuggestLimit((n) => n + SUGGEST_PAGE_SIZE)}>
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
            className={`num${weightHasWarning(weight) ? " invalid" : ""}`}
            value={weight}
            placeholder="使用量(g)"
            inputMode="decimal"
            onChange={(e) => setWeight(normalizeWeightInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          {weightWarningMessage(weight) && <span className="weight-warning">{weightWarningMessage(weight)}</span>}
        </div>
        <DishSelect
          dishes={dishes}
          value={dishName}
          emptyLabel="タグなし"
          className="add-card-dish"
          style={{ background: dishTint(dishes, dishes.find((d) => d.name === dishName)?.id ?? null) }}
          ariaLabel="追加する材料の料理タグ"
          onChange={changeDish}
        />
        <button type="button" className="add-card-btn" disabled={!canAdd} onClick={add}>
          材料を追加
        </button>
      </div>
    </div>
  );
}
