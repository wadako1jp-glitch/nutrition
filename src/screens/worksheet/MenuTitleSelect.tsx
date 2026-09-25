// 献立名（「20260925_肉じゃが他」の形）。日付は作成日で固定、後ろだけプルダウンで選ぶ。
// 「自動」のあいだは材料から推定した料理名に付け替え続け（src/core/dishName.ts）、
// 料理名や朝食・昼食…を選ぶと「固定」になって以後は変わらない。「自動」を選び直せば自動に戻る。
import { MEALS } from "../../core/menuTitle";

export type TitleChoice = { mode: "auto" } | { mode: "fixed"; label: string };

export default function MenuTitleSelect({
  date,
  title,
  auto,
  autoLabel,
  candidates,
  onChange,
}: {
  date: string; // yyyymmdd
  title: string; // 今の献立名（全体）
  auto: boolean;
  autoLabel: string; // 自動のときの名前（推定した料理名、推定できなければ朝食・昼食…）
  candidates: string[]; // 推定した料理名（固定で選べる）
  onChange: (choice: TitleChoice) => void;
}) {
  const prefix = `${date}_`;
  // 固定の名前が「日付_」で始まらないのは旧版で自由入力された献立名
  const legacy = !auto && !title.startsWith(prefix);
  const current = auto ? "auto" : legacy ? "legacy" : `fixed:${title.slice(prefix.length)}`;
  const labels = [...new Set([...candidates, ...MEALS, ...(auto || legacy ? [] : [title.slice(prefix.length)])])];

  return (
    <span className="menu-title-input" title={title}>
      <span className="menu-title-date">{prefix}</span>
      <select
        className="menu-title-meal"
        aria-label="献立名"
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "auto") onChange({ mode: "auto" });
          else if (v.startsWith("fixed:")) onChange({ mode: "fixed", label: v.slice("fixed:".length) });
        }}
      >
        <option value="auto">{autoLabel}（自動）</option>
        {legacy && <option value="legacy">（旧: {title}）</option>}
        {labels.map((l) => (
          <option key={l} value={`fixed:${l}`}>
            {l}
          </option>
        ))}
      </select>
    </span>
  );
}
