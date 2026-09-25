// 共有用の画像（横長PNG）を Canvas に直接描く。
// 以前は画面の表を html-to-image で写し取っていたが、部品ごとに見た目の設定を全部読み直すため
// スマホで数秒かかり、その間画面が固まっていた。中身（exportSheet.ts）が分かっているので、
// 表の線・文字を直接描けば一瞬で済む。見た目は画像用表示の表（styles.css の .sheet-table / .export-*）に合わせている。
import { ExportSheet, ExportSheetRow } from "./exportSheet";

// 見た目の設定（styles.css と揃える）
const FONT_TEXT = '"BIZ UDPGothic", "Hiragino Sans", "Yu Gothic", sans-serif';
const FONT_NUM = '"IBM Plex Mono", Menlo, monospace';
const COLOR = {
  ink: "#1f1c18",
  sub: "#777777",
  rule: "#c9c9c9",
  strong: "#222222",
  headerBg: "#e6e6e6",
  subtotalBg: "#eeeeee",
  dishRule: "#888888",
  chipBorder: "#8a8272",
  chipBg: "rgba(255, 255, 255, 0.7)",
  paper: "#ffffff",
};
const PAD_X = 6; // セルの左右の余白
const ROW_H = 24; // 1行の高さ
const HEAD_H = 36; // 見出し（2段）の高さ
const MARGIN = { x: 12, y: 10 };
const TITLE_H = 44; // 献立名＋作成日の欄
const CHIP_GAP = 6;

function font(size: number, bold = false, family = FONT_TEXT) {
  return `${bold ? "700 " : ""}${size}px ${family}`;
}

const isNumCol = (col: number) => col >= 1; // 使用量と栄養素の列は数字（右寄せ・等幅）

function cellFont(row: ExportSheetRow, col: number) {
  const bold = row.kind !== "item";
  const size = row.kind === "dish-subtotal" && col === 0 ? 11 : 12;
  return font(size, bold, isNumCol(col) ? FONT_NUM : FONT_TEXT);
}

// 列の幅を中身に合わせて決める（画面の表と同じく、材料名は折り返さない）
function columnWidths(ctx: CanvasRenderingContext2D, sheet: ExportSheet): number[] {
  const n = sheet.header.length;
  const widths = new Array(n).fill(0);
  ctx.font = font(11, true);
  sheet.header.forEach(([a, b], i) => {
    widths[i] = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
  });
  for (const row of sheet.rows) {
    row.cells.forEach((text, i) => {
      ctx.font = cellFont(row, i);
      let w = ctx.measureText(text).width;
      if (i === 0 && row.chip) {
        ctx.font = font(10, true);
        w += CHIP_GAP + ctx.measureText(row.chip).width + 12;
      }
      widths[i] = Math.max(widths[i], w);
    });
  }
  return widths.map((w, i) => Math.ceil(w + PAD_X * 2 + (i === 0 ? 0 : 2)));
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  // 線を画素の境目に合わせてにじまないようにする
  const o = width % 2 ? 0.5 : 0;
  ctx.moveTo(Math.round(x1) + o, Math.round(y1) + o);
  ctx.lineTo(Math.round(x2) + o, Math.round(y2) + o);
  ctx.stroke();
}

// 角の丸い四角（roundRect は iOS 15 以前の Safari に無いので自前で描く）
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawChip(ctx: CanvasRenderingContext2D, text: string, x: number, midY: number) {
  ctx.font = font(10, true);
  const w = ctx.measureText(text).width + 12;
  const h = 16;
  const y = midY - h / 2;
  ctx.fillStyle = COLOR.chipBg;
  ctx.strokeStyle = COLOR.chipBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRect(ctx, x + 0.5, y + 0.5, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#333333";
  ctx.textAlign = "left";
  ctx.fillText(text, x + 6.5, midY + 0.5);
}

/** 表を描いた Canvas を返す。scale は画素密度（2 = Retina 相当のくっきりした画像）。 */
export function drawExportSheet(sheet: ExportSheet, scale = 2): HTMLCanvasElement {
  const measure = document.createElement("canvas").getContext("2d")!;
  const widths = columnWidths(measure, sheet);
  const tableW = widths.reduce((a, b) => a + b, 0);
  const tableH = HEAD_H + ROW_H * sheet.rows.length;
  measure.font = font(17, true);
  const titleW = measure.measureText(sheet.title).width;
  measure.font = font(11);
  const subW = measure.measureText(sheet.subtitle).width;
  const contentW = Math.max(tableW, titleW, subW);
  const W = Math.ceil(contentW + MARGIN.x * 2);
  const H = Math.ceil(MARGIN.y * 2 + TITLE_H + (sheet.rows.length ? tableH : 20));

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "middle";

  // 献立名と作成日（下に太線）
  let y = MARGIN.y;
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = "left";
  ctx.font = font(17, true);
  ctx.fillText(sheet.title, MARGIN.x, y + 11);
  ctx.fillStyle = COLOR.sub;
  ctx.font = font(11);
  ctx.fillText(sheet.subtitle, MARGIN.x, y + 29);
  line(ctx, MARGIN.x, y + TITLE_H - 6, MARGIN.x + contentW, y + TITLE_H - 6, COLOR.strong, 2);
  y += TITLE_H;

  if (!sheet.rows.length) {
    ctx.fillStyle = COLOR.sub;
    ctx.font = font(11);
    ctx.fillText("材料が入力されていません。", MARGIN.x, y + 10);
    return canvas;
  }

  const x0 = MARGIN.x;
  const colX = widths.reduce<number[]>((xs, w, i) => [...xs, xs[i] + w], [x0]);

  // 見出し
  ctx.fillStyle = COLOR.headerBg;
  ctx.fillRect(x0, y, tableW, HEAD_H);
  ctx.fillStyle = COLOR.ink;
  ctx.font = font(11, true);
  sheet.header.forEach(([a, b], i) => {
    if (i === 0) {
      ctx.textAlign = "left";
      ctx.fillText(a, colX[i] + PAD_X, y + HEAD_H / 2);
    } else {
      ctx.textAlign = "right";
      ctx.fillText(a, colX[i + 1] - PAD_X, y + HEAD_H / 2 - 7);
      ctx.fillText(b, colX[i + 1] - PAD_X, y + HEAD_H / 2 + 8);
    }
  });
  line(ctx, x0, y + HEAD_H, x0 + tableW, y + HEAD_H, COLOR.strong);
  y += HEAD_H;

  // 本体
  for (const row of sheet.rows) {
    ctx.fillStyle = row.kind === "subtotal" ? COLOR.subtotalBg : (row.tint ?? COLOR.paper);
    ctx.fillRect(x0, y, tableW, ROW_H);
    const midY = y + ROW_H / 2 + 0.5;
    row.cells.forEach((text, i) => {
      ctx.fillStyle = COLOR.ink;
      ctx.font = cellFont(row, i);
      if (isNumCol(i)) {
        ctx.textAlign = "right";
        ctx.fillText(text, colX[i + 1] - PAD_X, midY);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(text, colX[i] + PAD_X, midY);
        if (row.chip) drawChip(ctx, row.chip, colX[i] + PAD_X + ctx.measureText(text).width + CHIP_GAP, midY);
      }
    });
    line(ctx, x0, y + ROW_H, x0 + tableW, y + ROW_H, row.kind === "dish-subtotal" ? COLOR.dishRule : COLOR.rule);
    y += ROW_H;
  }

  // 縦の罫線（使用量の右は太線で、材料と栄養価を分ける）と外枠
  const top = MARGIN.y + TITLE_H;
  for (let i = 1; i < widths.length; i++) {
    const strong = i === 2;
    line(ctx, colX[i], top, colX[i], y, strong ? COLOR.strong : COLOR.rule, strong ? 2 : 1);
  }
  ctx.strokeStyle = COLOR.strong;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, top + 0.5, tableW - 1, y - top - 1);
  return canvas;
}

/** 表を描いて PNG にする。 */
export function exportSheetToPng(sheet: ExportSheet, scale = 2): Promise<Blob | null> {
  const canvas = drawExportSheet(sheet, scale);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
