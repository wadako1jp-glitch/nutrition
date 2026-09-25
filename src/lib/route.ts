// 画面とURLの対応（スマホの「戻る」ボタンで前の画面に戻れるようにするため）。
// URLの「#」より後ろだけを使う（例: …/#/menu/menu_123/order）。サーバー側の設定が要らず、オフラインでも動く。
//
//   #/                        献立一覧
//   #/menu/<献立ID>            入力画面（材料表）
//   #/menu/<献立ID>/order      発注量
//   #/menu/<献立ID>/image      画像用表示
//   #/summary?ids=<ID>,<ID>    合計・充足率（チェックした献立）
//   #/profile                 プロフィール・設定
//
// ここは文字列とデータの変換だけ（Reactにも画面にも依存しない）。履歴の操作は src/hooks/useRoute.ts。

export type WorksheetMode = "sheet" | "order" | "image"; // 材料表 / 発注量 / 画像用表示

export type Route =
  | { name: "list" }
  | { name: "edit"; menuId: string; mode: WorksheetMode }
  | { name: "summary"; menuIds: string[] }
  | { name: "profile" };

export const LIST_ROUTE: Route = { name: "list" };

// URLの「#」以降を画面に変換する。知らない形は献立一覧にする
export function parseRoute(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean).map(safeDecode);
  if (parts[0] === "menu" && parts[1] && parts.length <= 3) {
    const mode = parts[2] ?? "sheet";
    if (mode === "sheet" || mode === "order" || mode === "image") return { name: "edit", menuId: parts[1], mode };
  }
  if (parts[0] === "summary" && parts.length === 1) {
    const ids = new URLSearchParams(query).get("ids");
    return { name: "summary", menuIds: ids ? ids.split(",").filter(Boolean) : [] };
  }
  if (parts[0] === "profile" && parts.length === 1) return { name: "profile" };
  return LIST_ROUTE;
}

// 画面をURLの「#」以降に変換する（parseRoute の逆）
export function formatRoute(route: Route): string {
  switch (route.name) {
    case "list":
      return "#/";
    case "edit":
      return `#/menu/${encodeURIComponent(route.menuId)}${route.mode === "sheet" ? "" : `/${route.mode}`}`;
    case "summary":
      return route.menuIds.length ? `#/summary?ids=${route.menuIds.map(encodeURIComponent).join(",")}` : "#/summary";
    case "profile":
      return "#/profile";
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
