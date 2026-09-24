// 利用者プロフィール（食事摂取基準の区分を引くための情報）。1件のみ保持する。
import { storage } from "./index";

export type Sex = "male" | "female";
export type ActivityLevel = 1 | 2 | 3; // 身体活動レベル I（低い）/ II（ふつう）/ III（高い）

export interface Profile {
  age: number; // 歳
  sex: Sex;
  activityLevel: ActivityLevel;
  heightCm: number | null; // 任意
  weightKg: number | null; // 任意
}

const KEY = "nutritionApp.profile.v1";

export async function getProfile(): Promise<Profile | null> {
  const p = await storage.get<Profile>(KEY);
  if (!p || typeof p.age !== "number" || (p.sex !== "male" && p.sex !== "female") || ![1, 2, 3].includes(p.activityLevel)) {
    return null;
  }
  return { ...p, heightCm: p.heightCm ?? null, weightKg: p.weightKg ?? null };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await storage.set(KEY, profile);
}
