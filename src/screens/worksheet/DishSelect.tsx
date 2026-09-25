// 料理タグ（主食・主菜など）を選ぶプルダウン。材料追加欄と、表の各行で同じものを使う。
// 選択肢はプリセット＋この献立で作った自由入力タグ＋「＋自由入力…」。
import type { CSSProperties } from "react";
import { Dish, dishOptionNames } from "../../core/dishes";

// プルダウンの「＋自由入力…」を表す値
export const CUSTOM_DISH = "__custom__";

export default function DishSelect({
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

// プルダウンで選んだ値をタグ名にする。"" = タグなし（null）、「＋自由入力…」なら名前を聞く。
// 名前の入力をやめた・空欄なら undefined（= 何も変えない）
export function resolveDishSelection(value: string): string | null | undefined {
  if (value === "") return null;
  if (value === CUSTOM_DISH) {
    const name = window.prompt("料理タグ名を入力（例：小鉢、飲み物）")?.trim();
    return name ? name : undefined;
  }
  return value;
}
