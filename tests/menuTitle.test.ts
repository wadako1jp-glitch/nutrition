import { describe, expect, it } from "vitest";
import { guessMeal, isMeal, menuDateStamp, menuTitle } from "../src/core/menuTitle";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe("献立名（yyyymmdd_区分）", () => {
  it("作成日を yyyymmdd（ゼロ埋め）にして区分とつなぐ", () => {
    expect(menuDateStamp(at(2026, 9, 4))).toBe("20260904");
    expect(menuTitle(at(2026, 12, 31), "朝食")).toBe("20261231_朝食");
  });

  it("新規献立の区分は作成時刻から推定する", () => {
    expect(guessMeal(at(2026, 9, 24, 7))).toBe("朝食");
    expect(guessMeal(at(2026, 9, 24, 12))).toBe("昼食");
    expect(guessMeal(at(2026, 9, 24, 15))).toBe("間食");
    expect(guessMeal(at(2026, 9, 24, 19))).toBe("夕食");
    expect(guessMeal(at(2026, 9, 24, 1))).toBe("夕食");
  });

  it("区分は朝食・昼食・夕食・間食のみ", () => {
    expect(isMeal("間食")).toBe(true);
    expect(isMeal("主食")).toBe(false);
    expect(isMeal(null)).toBe(false);
  });
});
