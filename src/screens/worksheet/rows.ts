// 入力画面（材料表）で扱う「材料の行」の形と、行まわりの小さな道具。
import type { CSSProperties } from "react";
import type { Food } from "../../data/foods";

export interface Row {
  id: number; // 画面の中だけで使う通し番号（保存はしない）
  food: Food; // 候補から選んで確定した食品。表に乗る行は常に確定済み
  usedWeight: string; // 使用量(g)＝料理で使う可食部の重さ。栄養計算もこの値をそのまま使う
  dishId: string | null; // 料理タグ。null = 未割当
}

let nextRowId = 1;
export function newRowId(): number {
  return nextRowId++;
}

// 行の淡いハイライト色をCSS変数で渡す（左に固定した列も同じ色で塗るため）
export function tintStyle(tint: string | undefined): CSSProperties | undefined {
  return tint ? ({ "--row-bg": tint } as CSSProperties) : undefined;
}
