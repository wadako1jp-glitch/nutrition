// 成分表の読み込みと検索。どの版を読むかは src/data/foodTable.ts の CURRENT_FOOD_TABLE で決める。
// docs/data-sources.md / CLAUDE.md「食品解決パイプライン」参照。

import { CURRENT_FOOD_TABLE } from "./foodTable";

export interface NumOrFlag {
  value: number | null;
  flag: string;
}

export type Cell = number | NumOrFlag | null;

export interface Food {
  group: string;
  code: string; // 食品番号 例: "01088"
  index: string; // 索引番号
  name: string; // 成分表の公式名（全角スペース区切りの階層名）
  waste_pct: Cell;
  kcal: Cell;
  protein_g: Cell;
  fat_g: Cell;
  carb_g: Cell;
  fiber_g: Cell;
  ca_mg: Cell;
  fe_mg: Cell;
  va_ugRAE: Cell;
  vd_ug: Cell;
  vb1_mg: Cell;
  vb2_mg: Cell;
  vc_mg: Cell;
  salt_g: Cell;
}

// Cell -> 計算に使える数値（Tr・推定値は0扱い、欠損はnull）
export function cellValue(c: Cell): number | null {
  if (c === null || c === undefined) return null;
  if (typeof c === "number") return c;
  return c.value;
}

let cache: Food[] | null = null;

export async function loadFoods(): Promise<Food[]> {
  if (cache) return cache;
  // サブパス配信（例: pepstech.pw/nutrition/）でも解決できるよう BASE_URL を前置する
  const res = await fetch(`${import.meta.env.BASE_URL}${CURRENT_FOOD_TABLE.file}`);
  const foods = (await res.json()) as Food[];
  cache = foods;
  return foods;
}

// 全角英数字(Ａ-Ｚａ-ｚ０-９) -> 半角。ローマ字・食品コードをどちらの幅で打っても検索できるようにする。
export function toHalfWidthAscii(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// 半角カタカナ -> 全角カタカナ（濁点・半濁点の結合込み）。ガラケー由来の半角カナ入力対策。
const HALFWIDTH_KANA: Record<string, string> = {
  ｦ: "ヲ", ｧ: "ァ", ｨ: "ィ", ｩ: "ゥ", ｪ: "ェ", ｫ: "ォ", ｬ: "ャ", ｭ: "ュ", ｮ: "ョ", ｯ: "ッ", ｰ: "ー",
  ｱ: "ア", ｲ: "イ", ｳ: "ウ", ｴ: "エ", ｵ: "オ",
  ｶ: "カ", ｷ: "キ", ｸ: "ク", ｹ: "ケ", ｺ: "コ",
  ｻ: "サ", ｼ: "シ", ｽ: "ス", ｾ: "セ", ｿ: "ソ",
  ﾀ: "タ", ﾁ: "チ", ﾂ: "ツ", ﾃ: "テ", ﾄ: "ト",
  ﾅ: "ナ", ﾆ: "ニ", ﾇ: "ヌ", ﾈ: "ネ", ﾉ: "ノ",
  ﾊ: "ハ", ﾋ: "ヒ", ﾌ: "フ", ﾍ: "ヘ", ﾎ: "ホ",
  ﾏ: "マ", ﾐ: "ミ", ﾑ: "ム", ﾒ: "メ", ﾓ: "モ",
  ﾔ: "ヤ", ﾕ: "ユ", ﾖ: "ヨ",
  ﾗ: "ラ", ﾘ: "リ", ﾙ: "ル", ﾚ: "レ", ﾛ: "ロ",
  ﾜ: "ワ", ﾝ: "ン",
};
const HALFWIDTH_DAKUTEN: Record<string, string> = {
  ｶ: "ガ", ｷ: "ギ", ｸ: "グ", ｹ: "ゲ", ｺ: "ゴ",
  ｻ: "ザ", ｼ: "ジ", ｽ: "ズ", ｾ: "ゼ", ｿ: "ゾ",
  ﾀ: "ダ", ﾁ: "ヂ", ﾂ: "ヅ", ﾃ: "デ", ﾄ: "ド",
  ﾊ: "バ", ﾋ: "ビ", ﾌ: "ブ", ﾍ: "ベ", ﾎ: "ボ",
};
const HALFWIDTH_HANDAKUTEN: Record<string, string> = { ﾊ: "パ", ﾋ: "ピ", ﾌ: "プ", ﾍ: "ペ", ﾎ: "ポ" };

function halfKanaToFullKana(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];
    if (next === "ﾞ" && HALFWIDTH_DAKUTEN[c]) {
      out += HALFWIDTH_DAKUTEN[c];
      i++;
    } else if (next === "ﾟ" && HALFWIDTH_HANDAKUTEN[c]) {
      out += HALFWIDTH_HANDAKUTEN[c];
      i++;
    } else {
      out += HALFWIDTH_KANA[c] ?? c;
    }
  }
  return out;
}

export function normalizeKana(s: string): string {
  // 全角英数字→半角、半角カナ→全角カナ、そのうえで全角/半角スペース除去・記号除去。
  const widthNormalized = halfKanaToFullKana(toHalfWidthAscii(s));
  return widthNormalized.replace(/[　\s・（）()［］\[\]<>＜＞]/g, "");
}

// 学生が書く一般名 -> 成分表の公式表記語（docs/data-sources.md 検証結果2）
export const SYNONYMS: Record<string, string> = {
  濃口醤油: "こいくちしょうゆ",
  濃口しょうゆ: "こいくちしょうゆ",
  薄口醤油: "うすくちしょうゆ",
  薄口しょうゆ: "うすくちしょうゆ",
  牛: "うし",
  豚: "ぶた",
  鶏: "にわとり",
  生姜: "しょうが",
  大根: "だいこん",
  人参: "にんじん",
  玉葱: "たまねぎ",
  玉ねぎ: "たまねぎ",
  葱: "ねぎ",
  馬鈴薯: "じゃがいも",
  南瓜: "かぼちゃ",
  牛蒡: "ごぼう",
  筍: "たけのこ",
  椎茸: "しいたけ",
  蒟蒻: "こんにゃく",
  白菜: "はくさい",
  胡瓜: "きゅうり",
  茄子: "なす",
  片栗粉: "じゃがいもでん粉",
  // 以下、実データで「生のまま検索しても一致しない」ことを確認した一般名 -> 実際に成分表の名称に
  // 含まれる語への変換（要件「予想変換の拡充」）。単純に漢字をひらがなに開くだけでは足りず、
  // 「肉」「粉」等の接尾辞が成分表側の名称と噛み合わないケースを個別に補っている。
  豚肉: "ぶた",
  鶏肉: "にわとり",
  牛肉: "うし",
  厚揚げ: "生揚げ",
  枝豆: "えだまめ",
  生クリーム: "クリーム",
  ごはん: "めし",
  ご飯: "めし",
  餃子: "ぎょうざ",
  こむぎ粉: "小麦粉",
  ちくわ: "竹輪",
};

function applySynonyms(term: string): string {
  let t = term;
  for (const [from, to] of Object.entries(SYNONYMS)) {
    t = t.split(from).join(to);
  }
  return t;
}

// --- 汎用食材（どの料理にも使われやすい調味料・卵など）のローマ字入力対応 ---
// 要件: 「塩やみそなどの調味料や卵などの汎用食材」をあいまい検索（ローマ字入力含む）できるようにする。
// キーはローマ字（小文字・記号除去後）、値は成分表の名称に実際に含まれる語（漢字/かな/カタカナ）。
// 既存の表記ゆれ辞書（SYNONYMS）・かな正規化（normalizeKana）にそのまま乗せて検索する。
export const ROMAJI_ALIASES: Record<string, string> = {
  shio: "食塩",
  sio: "食塩",
  miso: "みそ",
  shouyu: "しょうゆ",
  syouyu: "しょうゆ",
  shoyu: "しょうゆ",
  syoyu: "しょうゆ",
  soysauce: "しょうゆ",
  satou: "砂糖",
  sato: "砂糖",
  sugar: "砂糖",
  su: "食酢",
  osu: "食酢",
  vinegar: "食酢",
  mirin: "みりん",
  sake: "清酒",
  seishu: "清酒",
  kosho: "こしょう",
  koshou: "こしょう",
  pepper: "こしょう",
  dashi: "だし",
  katsuo: "かつおだし",
  katsuobushi: "かつおだし",
  konbu: "こんぶ",
  kombu: "こんぶ",
  tamago: "鶏卵",
  egg: "鶏卵",
  gyunyu: "牛乳",
  gyuunyuu: "牛乳",
  milk: "牛乳",
  bataa: "バター",
  batter: "バター",
  butter: "バター",
  chiizu: "チーズ",
  cheese: "チーズ",
  mayonezu: "マヨネーズ",
  mayo: "マヨネーズ",
  mayonnaise: "マヨネーズ",
  kechappu: "ケチャップ",
  ketchup: "ケチャップ",
  abura: "調合油",
  oil: "調合油",
  saladoil: "調合油",
  katakuriko: "片栗粉",
  negi: "ねぎ",
  nasu: "なす",
  kyuuri: "きゅうり",
  kyuri: "きゅうり",
  ninjin: "にんじん",
  tamanegi: "たまねぎ",
  daikon: "だいこん",
  jagaimo: "じゃがいも",
  // 肉・魚介
  butaniku: "ぶた",
  toriniku: "にわとり",
  gyuniku: "うし",
  hikiniku: "ひき肉",
  shake: "さけ", // "sake"は清酒に割り当て済みのため区別
  maguro: "まぐろ",
  aji: "あじ",
  saba: "さば",
  iwashi: "いわし",
  ebi: "えび",
  shrimp: "えび",
  ika: "いか",
  tako: "たこ",
  shirasu: "しらす",
  asari: "あさり",
  shijimi: "しじみ",
  hamaguri: "はまぐり",
  bacon: "ベーコン",
  ham: "ハム",
  sausage: "ソーセージ",
  wiener: "ウインナー",
  // 主食・粉物
  udon: "うどん",
  soba: "そば",
  supagetti: "スパゲッティ",
  pasta: "スパゲッティ",
  macaroni: "マカロニ",
  shokupan: "食パン",
  bread: "食パン",
  komugiko: "小麦粉",
  flour: "小麦粉",
  panko: "パン粉",
  gohan: "めし",
  rice: "めし",
  gyoza: "ぎょうざ",
  gyouza: "ぎょうざ",
  // 豆・卵・乳製品
  tofu: "豆腐",
  natto: "納豆",
  atsuage: "生揚げ",
  edamame: "えだまめ",
  yoguruto: "ヨーグルト",
  yogurt: "ヨーグルト",
  cream: "クリーム",
  // 野菜・きのこ・海藻・果物
  kyabetsu: "キャベツ",
  cabbage: "キャベツ",
  piiman: "ピーマン",
  piman: "ピーマン",
  tomato: "トマト",
  hourensou: "ほうれんそう",
  horenso: "ほうれんそう",
  komatsuna: "こまつな",
  moyashi: "もやし",
  ninniku: "にんにく",
  garlic: "にんにく",
  renkon: "れんこん",
  enoki: "えのきたけ",
  shimeji: "ぶなしめじ",
  konnyaku: "こんにゃく",
  shirataki: "しらたき",
  wakame: "わかめ",
  nori: "のり",
  hijiki: "ひじき",
  lettuce: "レタス",
  retasu: "レタス",
  ringo: "りんご",
  apple: "りんご",
  banana: "バナナ",
  mikan: "みかん",
  ichigo: "いちご",
  strawberry: "いちご",
  remon: "レモン",
  lemon: "レモン",
};

// 汎用食材として優先的に上位表示したい食品コード（検索結果の並び順を底上げする）
export const PRIORITY_CODES: ReadonlySet<string> = new Set([
  "17012",
  "17013",
  "17014",
  "17089", // 食塩
  "17044",
  "17045",
  "17046",
  "17120",
  "17145", // 米みそ
  "17007",
  "17008",
  "17086",
  "17139", // しょうゆ
  "03003",
  "03004", // 砂糖
  "17015",
  "17016",
  "17090", // 食酢
  "16025", // みりん
  "16001", // 清酒
  "17063",
  "17064",
  "17065", // こしょう
  "17019",
  "17131", // かつおだし
  "12004", // 鶏卵（全卵・生）
  "13003", // 普通牛乳
  "14017",
  "14018", // バター
  "13031",
  "13032",
  "13033",
  "13034",
  "13035",
  "13036",
  "13037",
  "13038",
  "13039", // チーズ
  "17042", // マヨネーズ
  "17036", // ケチャップ
  "14006", // 調合油（サラダ油）
]);

// ローマ字クエリを成分表側の語に変換する。完全一致優先、無ければ前方一致で拾う（入力途中でも候補を出す）。
// 全角ローマ字（ｓｈｉｏ等）でも変換できるよう、事前に半角化してから照合する。
function resolveRomaji(rawQuery: string): string | undefined {
  const key = toHalfWidthAscii(rawQuery).trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!key) return undefined;
  if (ROMAJI_ALIASES[key]) return ROMAJI_ALIASES[key];
  if (key.length < 2) return undefined;
  for (const k of Object.keys(ROMAJI_ALIASES)) {
    if (k.startsWith(key)) return ROMAJI_ALIASES[k];
  }
  return undefined;
}

export interface SearchResult {
  food: Food;
  score: number; // 小さいほど良い一致
}

// 食品名のあいまい検索。part-match: クエリの正規化文字列が
// 成分表側の正規化名に部分一致するものを、短い名前（＝より具体的な一致）優先で返す。
// 塩・みそ・卵などの汎用食材はさらに優先的に上位表示する（PRIORITY_CODES）。
// 数字（全角含む）を2桁以上打つと食品番号の前方一致検索として扱う（最優先で表示）。
// limitを省略するとマッチした全件を返す（呼び出し側で「もっと見る」のページングに使う）。
export function searchFoods(foods: Food[], query: string, limit = Infinity): SearchResult[] {
  const trimmed = toHalfWidthAscii(query.trim());
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // 食品番号の直打ち（前方一致）。数字が2桁以上入力された時点で候補に出す。
  const codeDigits = trimmed.replace(/[^\d]/g, "");
  if (codeDigits.length >= 2) {
    for (const food of foods) {
      if (food.code.startsWith(codeDigits)) {
        results.push({ food, score: -1000000 + (food.code.length - codeDigits.length) });
        seen.add(food.code);
      }
    }
  }

  // 名称のあいまい検索（かな・漢字・カタカナ・ローマ字）
  const romajiTerm = resolveRomaji(trimmed);
  const effectiveQuery = romajiTerm ?? trimmed;
  const q = normalizeKana(applySynonyms(effectiveQuery));
  if (q) {
    for (const food of foods) {
      if (seen.has(food.code)) continue;
      const nname = normalizeKana(food.name);
      if (nname.includes(q)) {
        const boost = PRIORITY_CODES.has(food.code) ? -100000 : 0;
        results.push({ food, score: boost + nname.length });
        seen.add(food.code);
      }
    }
  }

  results.sort((a, b) => a.score - b.score);
  return Number.isFinite(limit) ? results.slice(0, limit) : results;
}

export function findByCode(foods: Food[], code: string): Food | undefined {
  return foods.find((f) => f.code === code);
}
