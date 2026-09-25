// 合計・充足率。一覧でチェックした献立を合算し、食事摂取基準と比べて表示する（判定の計算は src/core/intake.ts）。
import { useEffect, useState } from "react";
import { DRI_VERSION } from "../data/dri/2025";
import { CURRENT_FOOD_TABLE } from "../data/foodTable";
import { Food, findByCode, loadFoods } from "../data/foods";
import { IntakeEvaluation, IntakeStatus, evaluateIntake, resolveReference } from "../core/intake";
import { NUTRIENT_KEYS, NUTRIENT_LABELS, NutrientRow, computeRow, sumRows } from "../core/nutrition";
import { weightValue } from "../core/weightInput";
import { StoredMenu, getMenu } from "../lib/storage/menus";
import { Profile, getProfile } from "../lib/storage/profile";

const STATUS_LABEL: Record<IntakeStatus, string> = {
  low: "不足",
  ok: "適正",
  high: "多い",
  over: "超過",
};

const ACTIVITY_LABEL = { 1: "I（低い）", 2: "II（ふつう）", 3: "III（高い）" } as const;

function menuSubtotal(menu: StoredMenu, foods: Food[]): NutrientRow {
  const rows = menu.rows
    .map((r) => {
      const food = findByCode(foods, r.code);
      return food ? computeRow(food, weightValue(r.usedWeight)) : null;
    })
    .filter((r): r is NutrientRow => r !== null);
  return sumRows(rows);
}

function fmtPct(p: number): string {
  return `${Math.round(p)}%`;
}

// 合計・充足率画面：選んだ献立（例：朝・昼・夕）の合計を食事摂取基準と比べる。
export default function DailySummary({
  menuIds,
  onBack,
  onEditProfile,
}: {
  menuIds: string[];
  onBack: () => void;
  onEditProfile: () => void;
}) {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [menus, setMenus] = useState<StoredMenu[] | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    loadFoods().then(setFoods);
    getProfile().then(setProfile);
    Promise.all(menuIds.map((id) => getMenu(id))).then((ms) => setMenus(ms.filter((m): m is StoredMenu => !!m)));
  }, [menuIds]);

  const loading = !foods || !menus || profile === undefined;
  const subtotals = foods && menus ? menus.map((m) => ({ menu: m, sub: menuSubtotal(m, foods) })) : [];
  const total = sumRows(subtotals.map((s) => s.sub));
  const reference = profile ? resolveReference(profile) : null;
  const evaluations = reference ? evaluateIntake(total, reference) : null;

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="back-btn" onClick={onBack} aria-label="献立一覧に戻る">
          ←
        </button>
        <span className="list-title">合計・充足率</span>
      </header>

      {loading ? (
        <p className="note">読み込み中…</p>
      ) : menus!.length === 0 ? (
        <div className="empty-card">
          <b>献立が選ばれていません</b>
          <span>献立一覧で合計したい献立（例：朝食・昼食・夕食）にチェックを入れてから開いてください。</span>
        </div>
      ) : (
        <>
          <div className="summary-menus">
            {subtotals.map(({ menu, sub }) => (
              <div key={menu.id} className="summary-menu">
                <span>{menu.title}</span>
                <span className="num">{sub.kcal} kcal</span>
              </div>
            ))}
            <div className="summary-menu total">
              <span>合計（{subtotals.length}献立）</span>
              <span className="num">{total.kcal} kcal</span>
            </div>
          </div>

          {profile === null ? (
            <div className="empty-card">
              <b>プロフィールが未設定です</b>
              <span>年齢・性別・身体活動レベルを設定すると、食事摂取基準に対する充足率を表示します。</span>
              <button type="button" className="add-card-btn" onClick={onEditProfile}>
                プロフィールを設定する
              </button>
            </div>
          ) : reference === null ? (
            <div className="empty-card">
              <b>この年齢の基準値は収録していません</b>
              <span>食事摂取基準の1歳以上の区分に対応しています。</span>
              <button type="button" className="add-card-btn" onClick={onEditProfile}>
                プロフィールを編集する
              </button>
            </div>
          ) : (
            <div className="profile-line">
              <span>
                基準: {reference.ageGroupLabel}・{profile!.sex === "male" ? "男性" : "女性"}・身体活動レベル
                {ACTIVITY_LABEL[reference.activityLevelUsed]}
              </span>
              <button type="button" className="link-btn" onClick={onEditProfile}>
                プロフィール編集
              </button>
              {reference.activityFallback && (
                <span className="profile-sub">
                  ※この年齢区分では身体活動レベル{ACTIVITY_LABEL[profile!.activityLevel]}の値が策定されていないため「ふつう」で計算しています。
                </span>
              )}
            </div>
          )}

          {evaluations ? (
            <>
              <ul className="intake-list">
                {evaluations.map((ev) => (
                  <IntakeItem key={ev.key} ev={ev} />
                ))}
              </ul>
              <div className="legend">
                {(["low", "ok", "high", "over"] as IntakeStatus[]).map((s) => (
                  <span key={s} className={`legend-item st-${s}`}>
                    <i />
                    {STATUS_LABEL[s]}
                  </span>
                ))}
                <span className="legend-note">不足＝基準の80%未満、多い＝120%超（脂質・炭水化物は目標範囲外）、超過＝上限を超える</span>
              </div>
            </>
          ) : (
            <table className="sheet-table totals-table">
              <tbody>
                {NUTRIENT_KEYS.map((k) => (
                  <tr key={k}>
                    <td className="t-label">{NUTRIENT_LABELS[k][0]}</td>
                    <td className="num">
                      {total[k]} {NUTRIENT_LABELS[k][1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <p className="note dri-note">
        基準値は{DRI_VERSION}による。食事摂取基準（2025年版）は七訂成分表に基づいて策定されています。本アプリは{CURRENT_FOOD_TABLE.label}で計算しているため、エネルギーおよびエネルギー産生栄養素（たんぱく質・脂質・炭水化物）について、基準値との間に測定法由来の差が生じます。参考値として扱ってください。
      </p>
    </div>
  );
}

function IntakeItem({ ev }: { ev: IntakeEvaluation }) {
  const statusClass = ev.status ? ` st-${ev.status}` : "";
  const barWidth = ev.percent === null ? 0 : Math.min(ev.percent, 150) / 1.5; // 150%でバーいっぱい
  let pctText = "—";
  if (ev.kind === "range") {
    if (ev.energyPct != null) pctText = `${ev.energyPct.toFixed(1)}%E`;
  } else if (ev.percent !== null) {
    pctText = ev.kind === "upper" ? `上限の${fmtPct(ev.percent)}` : fmtPct(ev.percent);
  }
  return (
    <li className={`intake-item${statusClass}`}>
      <div className="intake-head">
        <span className="intake-label">{ev.label}</span>
        <span className="intake-value num">
          {ev.intake} {ev.unit}
        </span>
        <span className="intake-pct num">{pctText}</span>
        {ev.status && <span className="intake-status">{STATUS_LABEL[ev.status]}</span>}
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${barWidth}%` }} />
        {/* 基準（100%）の位置。range は目標範囲の帯を描く */}
        {ev.kind === "range" && ev.rangeLowerPercent !== undefined ? (
          <div
            className="bar-band"
            style={{ left: `${ev.rangeLowerPercent / 1.5}%`, width: `${(100 - ev.rangeLowerPercent) / 1.5}%` }}
          />
        ) : null}
        <div className="bar-mark" style={{ left: `${100 / 1.5}%` }} />
      </div>
      <div className="intake-ref">
        {ev.indicator}：{ev.referenceText}
      </div>
    </li>
  );
}
