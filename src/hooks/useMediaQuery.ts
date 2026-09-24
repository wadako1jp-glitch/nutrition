import { useEffect, useState } from "react";

// ワイド表示の判定（変更仕様004 F-1）。幅を主、向きを補助とする。
// styles.css の「ワイド表示」の @media と必ず同じ条件にすること。
export const WIDE_QUERY = "(min-width: 700px), (orientation: landscape) and (min-width: 600px)";

// メディアクエリに一致しているか。ウィンドウリサイズ・端末回転に追従する。
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
