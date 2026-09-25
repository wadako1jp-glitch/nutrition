// 画像用表示（提出・共有用）。入力用と同じ形の表を、横長・全画面・スクロール無しで1画面に収める。
// 縦持ちなら中身を90°回して横長に見せる。「共有」でOS標準の共有シートを開く（画像は Canvas で先に作っておく）。
// 画像の描き方は src/features/export-image/（exportSheet.ts＝載せる中身、drawExportSheet.ts＝描き方）。
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dish, dishTint, groupRowsByDish } from "../../core/dishes";
import { NUTRIENT_KEYS, NUTRIENT_LABELS, NutrientRow } from "../../core/nutrition";
import { CURRENT_FOOD_TABLE } from "../../data/foodTable";
import { exportSheetToPng } from "../../features/export-image/drawExportSheet";
import { buildExportSheet } from "../../features/export-image/exportSheet";
import { Row, tintStyle } from "./rows";
import { GroupSubtotalRow, showGroupSubtotal } from "./SheetTable";

const COLUMN_LABELS = NUTRIENT_LABELS;

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
export default function ExportView({
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
