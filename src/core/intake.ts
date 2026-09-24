// 1日分の合計栄養量を食事摂取基準と比べる純粋ロジック（Reactに依存しない）。
// 項目ごとの指標は 変更仕様002 C-3 の対応表に従う。
import { AGE_GROUPS, CARB_DG_PCT, DRI_2025, FAT_DG_PCT, SexTable } from "../data/dri/2025";
import type { ActivityLevel, Profile } from "../lib/storage/profile";
import { NUTRIENT_LABELS, NutrientKey, NutrientRow } from "./nutrition";

// low = 大きく不足 / ok = 概ね基準どおり / high = 大きく超える（悪いとは限らない）/ over = 上限超過（警告）
export type IntakeStatus = "low" | "ok" | "high" | "over";

// 推奨量等に対する充足率がこの範囲外なら「大きく下回る／上回る」とみなす
export const LOW_PCT = 80;
export const HIGH_PCT = 120;

// %エネルギー換算の係数（用紙での手計算と同じく たんぱく質・炭水化物4、脂質9 kcal/g）
const FAT_KCAL_PER_G = 9;
const CARB_KCAL_PER_G = 4;

export interface ResolvedReference {
  ageGroupLabel: string;
  activityLevelUsed: ActivityLevel;
  activityFallback: boolean; // その年齢区分に指定の身体活動レベルが無く「ふつう」で代用した
  ironMenstruating: boolean; // 女性で「月経あり」の値を使った
  table: SexTable;
  index: number;
}

export function resolveReference(profile: Profile): ResolvedReference | null {
  const index = AGE_GROUPS.findIndex((g) => profile.age >= g.min && profile.age <= g.max);
  if (index < 0) return null; // 1歳未満は対象外
  const table = DRI_2025[profile.sex];
  const eerRow = table.eer[index];
  const wanted = profile.activityLevel;
  const available = eerRow[wanted - 1] !== null;
  return {
    ageGroupLabel: AGE_GROUPS[index].label,
    activityLevelUsed: available ? wanted : 2,
    activityFallback: !available,
    ironMenstruating: profile.sex === "female" && table.feRdaMenstruating?.[index] != null,
    table,
    index,
  };
}

export interface IntakeEvaluation {
  key: NutrientKey;
  label: string;
  unit: string;
  intake: number;
  indicator: string; // 参照した指標名
  referenceText: string; // 基準値の表示
  kind: "adequacy" | "range" | "upper";
  // バーの長さ（%）。adequacy=基準値に対する充足率、range=目標範囲の上限に対する割合、upper=上限に対する割合
  percent: number | null;
  rangeLowerPercent?: number; // range のとき、目標範囲の下限がバー上のどこか（%）
  energyPct?: number | null; // range のとき、%エネルギー
  status: IntakeStatus | null;
}

function adequacy(intake: number, ref: number | null): { percent: number | null; status: IntakeStatus | null } {
  if (ref === null || ref <= 0) return { percent: null, status: null };
  const percent = (intake / ref) * 100;
  const status: IntakeStatus = percent < LOW_PCT ? "low" : percent > HIGH_PCT ? "high" : "ok";
  return { percent, status };
}

function fmt(n: number): string {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

export function evaluateIntake(total: NutrientRow, ref: ResolvedReference): IntakeEvaluation[] {
  const { table, index: i } = ref;
  const base = (key: NutrientKey) => ({ key, label: NUTRIENT_LABELS[key][0], unit: NUTRIENT_LABELS[key][1], intake: total[key] });
  const rda = (key: NutrientKey, indicator: string, value: number | null, suffix = ""): IntakeEvaluation => ({
    ...base(key),
    indicator,
    referenceText: value === null ? "策定なし" : `${fmt(value)} ${NUTRIENT_LABELS[key][1]}${suffix}`,
    kind: "adequacy",
    ...adequacy(total[key], value),
  });
  const energyRange = (key: "fat_g" | "carb_g", kcalPerG: number, [lo, hi]: [number, number], overIsWarning: boolean): IntakeEvaluation => {
    const energyPct = total.kcal > 0 ? (total[key] * kcalPerG * 100) / total.kcal : null;
    let status: IntakeStatus | null = null;
    if (energyPct !== null) {
      if (energyPct < lo) status = "low";
      else if (energyPct > hi) status = overIsWarning ? "over" : "high";
      else status = "ok";
    }
    return {
      ...base(key),
      indicator: "目標量（%エネルギー）",
      referenceText: `${lo}〜${hi} %E`,
      kind: "range",
      percent: energyPct === null ? null : (energyPct / hi) * 100,
      rangeLowerPercent: (lo / hi) * 100,
      energyPct,
      status,
    };
  };

  const eer = table.eer[i][ref.activityLevelUsed - 1];
  const fe = ref.ironMenstruating ? table.feRdaMenstruating![i] : table.feRda[i];
  const salt = table.saltDg[i];
  const saltPercent = salt ? (total.salt_g / salt) * 100 : null;

  return [
    rda("kcal", "推定エネルギー必要量", eer),
    rda("protein_g", "推奨量", table.proteinRda[i]),
    // 脂質は上限側を超えたら警告（食塩と同じ扱い）
    energyRange("fat_g", FAT_KCAL_PER_G, FAT_DG_PCT, true),
    energyRange("carb_g", CARB_KCAL_PER_G, CARB_DG_PCT, false),
    rda("fiber_g", "目標量", table.fiberDg[i], " 以上"),
    rda("ca_mg", "推奨量", table.caRda[i]),
    rda("fe_mg", ref.ironMenstruating ? "推奨量（月経あり）" : "推奨量", fe),
    rda("va_ugRAE", "推奨量", table.vaRda[i]),
    rda("vd_ug", "目安量", table.vdAi[i]),
    rda("vb1_mg", "推奨量", table.vb1Rda[i]),
    rda("vb2_mg", "推奨量", table.vb2Rda[i]),
    rda("vc_mg", "推奨量", table.vcRda[i]),
    {
      ...base("salt_g"),
      indicator: "目標量（上限）",
      referenceText: salt === null ? "策定なし" : `${fmt(salt)} g 未満`,
      kind: "upper",
      percent: saltPercent,
      // 目標量は「未満」なので、目標量ちょうどに達した時点で超過扱い
      status: saltPercent === null ? null : saltPercent >= 100 ? "over" : "ok",
    },
  ];
}
