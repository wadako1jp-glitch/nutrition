// 成分表の版の定義。アプリが使う版はここの CURRENT_FOOD_TABLE の1か所で決める。
// 改訂版（九訂など）に切り替えるときの手順は docs/food-table-upgrade.md を参照。

export interface FoodTableVersion {
  id: string; // 版の識別子（data/mext-tables/<id>/ と献立データの foodTable に使う）
  label: string; // 画面の注記用 例: 「八訂（増補2023）」
  shortLabel: string; // 画像用表示など、括弧を重ねたくない場所用 例: 「八訂 増補2023」
  file: string; // public/ からの相対パス（ビルド後の配信パス。BASE_URL を前置して取得する）
}

export const FOOD_TABLES = {
  "2023_増補": {
    id: "2023_増補",
    label: "八訂（増補2023）",
    shortLabel: "八訂 増補2023",
    file: "data/foods.2023-zouho.json",
  },
} as const satisfies Record<string, FoodTableVersion>;

export const CURRENT_FOOD_TABLE: FoodTableVersion = FOOD_TABLES["2023_増補"];

// 版の記録（StoredMenu.foodTable）を始める前に保存された献立は、すべてこの版で作られている
export const LEGACY_FOOD_TABLE_ID = "2023_増補";
