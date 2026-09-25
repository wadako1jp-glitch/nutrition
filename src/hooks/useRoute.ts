// 今の画面（URL）を読み、画面を移るたびにブラウザの履歴に積む。
// これでスマホの「戻る」ボタン・スワイプで戻る操作が、アプリ内の前の画面に戻るようになる。
// URLと画面の対応表は src/lib/route.ts。
import { useCallback, useEffect, useState } from "react";
import { Route, formatRoute, parseRoute } from "../lib/route";

// 履歴の各項目に持たせる情報
//   idx:   履歴の何番目か（アプリを開いた画面が0）。0 のときに「戻る」とアプリの外へ出てしまうので、
//          画面上の「←」などでは代わりに行き先（fallback）へ差し替える
//   depth: 同じ画面の中で重ねた表示の数（材料表=0 → 発注量=1 → 画像用表示=2）。
//          入力画面の「←」で、重ねた表示ごと一気に一覧へ戻るのに使う
interface HistoryState {
  idx: number;
  depth: number;
}

function currentState(): HistoryState {
  const s = window.history.state as Partial<HistoryState> | null;
  return { idx: typeof s?.idx === "number" ? s.idx : 0, depth: typeof s?.depth === "number" ? s.depth : 0 };
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    // 開いたときのURLを正しい形に揃え、履歴の番号を振っておく
    window.history.replaceState(currentState(), "", formatRoute(parseRoute(window.location.hash)));
    const onPopState = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 次の画面へ進む（履歴に積む）。overlay = 今の画面の上に重ねる表示（入力画面の発注量・画像用表示）
  const navigate = useCallback((next: Route, overlay = false) => {
    const cur = currentState();
    const state: HistoryState = { idx: cur.idx + 1, depth: overlay ? cur.depth + 1 : 0 };
    window.history.pushState(state, "", formatRoute(next));
    setRoute(next);
  }, []);

  // 今の画面を差し替える（履歴に積まない）
  const replace = useCallback((next: Route) => {
    window.history.replaceState({ ...currentState(), depth: 0 }, "", formatRoute(next));
    setRoute(next);
  }, []);

  // 画面上の「←」「閉じる」など。アプリ内に前の画面があれば戻り、無ければ（URLを直接開いた等）fallback へ
  const goBack = useCallback(
    (fallback: Route) => {
      if (currentState().idx > 0) window.history.back();
      else replace(fallback);
    },
    [replace],
  );

  // 重ねた表示（発注量・画像用表示）ごと閉じて、その画面の1つ前へ戻る（入力画面の「←」）
  const leave = useCallback(
    (fallback: Route) => {
      const { idx, depth } = currentState();
      if (idx - depth > 0) window.history.go(-(depth + 1));
      else replace(fallback);
    },
    [replace],
  );

  return { route, navigate, replace, goBack, leave };
}
