// 献立名は自由入力させず「yyyymmdd_食事区分」の無機質な形式にする（日付は作成日で固定、区分だけ選ぶ）。

export const MEALS = ["朝食", "昼食", "夕食", "間食"] as const;
export type Meal = (typeof MEALS)[number];

export function isMeal(v: unknown): v is Meal {
  return typeof v === "string" && (MEALS as readonly string[]).includes(v);
}

// 作成日（端末のローカル日付）を yyyymmdd で
export function menuDateStamp(createdAt: number): string {
  const d = new Date(createdAt);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export function menuTitle(createdAt: number, meal: Meal): string {
  return `${menuDateStamp(createdAt)}_${meal}`;
}

// 新しい献立の区分の初期値（作った時刻から推定。あとでプルダウンで変えられる）
export function guessMeal(createdAt: number): Meal {
  const h = new Date(createdAt).getHours();
  if (h >= 4 && h < 10) return "朝食";
  if (h >= 10 && h < 15) return "昼食";
  if (h >= 15 && h < 17) return "間食";
  return "夕食";
}
