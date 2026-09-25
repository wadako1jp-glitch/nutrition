// ワイド表示（横持ち・広い画面、変更仕様004）で、ツールバーと材料追加欄を隠したり出したりする。
// 表の列・レイアウトの切り替えは styles.css のメディアクエリだけで行う。ここでやるのは
// 「chrome-shown」クラスを付け外しすることだけで、画面の部品の構造は変えない
// （狭い版/広い版を出し分けると入力欄が作り直され、入力中の文字やIMEの変換中の文字が消えるため）。
// 入力中の欄を含むツールバー・材料追加欄は :focus-within で隠れない（CSS側）。
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { WIDE_QUERY, useMediaQuery } from "../../hooks/useMediaQuery";

const HIDE_AFTER_MS = 4000; // 自動で隠すまでの時間

export function useWideChrome() {
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
      }, HIDE_AFTER_MS);
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [wide, chromeShown]);

  // ワイド表示中、表の余白や数値セルのタップでツールバー・材料追加欄を表示／非表示
  function handlePageClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!wide) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, label, a, .topbar, .add-card, .confirm-overlay, .export-overlay, .order-view"))
      return;
    setChromeShown((v) => !v);
  }

  return { chromeShown, showChrome: () => setChromeShown(true), handlePageClick, topbarRef, addCardRef };
}
