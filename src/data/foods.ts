// 成分表の読み込みと検索。どの版を読むかは src/data/foodTable.ts の CURRENT_FOOD_TABLE で決める。
// docs/data-sources.md / CLAUDE.md「食品解決パイプライン」参照。

import { FOOD_ALIASES } from "./foodAliases";
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
  waste_part?: string | null; // 廃棄部位（成分表の備考「廃棄部位：」）。発注量表示で何を切り捨てたかを示す
  // 以下は発注量表示で「実際に買う形」を示すための、成分表の備考から取り出した値（該当する食品にだけある）
  raw_equiv?: { label: string; g_per_100g: number }; // めし・かゆ: 可食部100gに含まれる炊く前の米の重さ
  grated?: { ratio_pct: number; source_code: string; source_name: string; source_waste_pct: Cell }; // おろし: おろす前の食品に対する割合
  peel_alt?: { code: string; label: string; waste_pct: Cell }; // 皮つき⇔皮なしの対になる食品
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

// カタカナ -> ひらがな。「ニンジン」「にんじん」、成分表の「キャベツ」と入力の「きゃべつ」を同じに扱う。
// 長音「ー」はそのまま残す（成分表もかな表記の中で「ー」を使っているため）。
export function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// 検索用の正規化（空白は残す）: 全角英数字→半角、半角カナ→全角カナ、カタカナ→ひらがな、記号除去。
function normalizeKeepSpaces(s: string): string {
  const widthNormalized = halfKanaToFullKana(toHalfWidthAscii(s));
  return katakanaToHiragana(widthNormalized).replace(/[・（）()［］[\]<>＜＞]/g, "");
}

export function normalizeKana(s: string): string {
  // 検索用の正規化に加えて、全角/半角スペースも除去する（食品名側・1語ぶんのクエリ用）。
  return normalizeKeepSpaces(s).replace(/[　\s]/g, "");
}

// 読み替え表（src/data/foodAliases.ts）を「正規化した別名 -> 正規化した呼び名の語の並び」にしたもの。
// 別名は長い順に並べ、クエリの左から最長一致で1回だけ読み替える。
// （以前は辞書を定義順に全部適用していたため、「鶏→にわとり」が先に当たって「鶏肉」が
//   「にわとり肉」になり、どの食品にも一致しなかった）
const ALIAS_MAP = new Map<string, string[]>();
const ALIAS_ENTRIES: [string, string[]][] = (() => {
  const map = ALIAS_MAP;
  for (const [target, forms] of Object.entries(FOOD_ALIASES)) {
    const words = target.split(/\s+/).map(normalizeKana).filter(Boolean);
    for (const form of forms) {
      const key = normalizeKana(form);
      if (key && !map.has(key)) map.set(key, words);
    }
  }
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length);
})();

// 1語（空白を含まない正規化済みの語）を読み替えて、食品名に含まれているべき語の並びにする。
// 読み替えの当たらなかった部分はそのまま1語として残す（「豚ロース」→「ぶた」「ろーす」）。
export function expandAliases(word: string): string[] {
  const out: string[] = [];
  let rest = "";
  let i = 0;
  while (i < word.length) {
    const hit = ALIAS_ENTRIES.find(([key]) => word.startsWith(key, i));
    if (hit) {
      if (rest) out.push(rest);
      rest = "";
      out.push(...hit[1]);
      i += hit[0].length;
    } else {
      rest += word[i];
      i++;
    }
  }
  if (rest) out.push(rest);
  return out;
}

// --- 汎用食材（どの料理にも使われやすい調味料・卵など）のローマ字入力対応 ---
// 要件: 「塩やみそなどの調味料や卵などの汎用食材」をあいまい検索（ローマ字入力含む）できるようにする。
// キーはローマ字（小文字・記号除去後）、値は成分表の名称に実際に含まれる語（漢字/かな/カタカナ）。
// 読み替え表（FOOD_ALIASES）・かな正規化（normalizeKana）にそのまま乗せて検索する。
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
  // 調理実習でよく使う食材の代表的な1品（「鶏肉」「豆腐」のような大まかな語で、内臓や加工品より先に出す）
  "11221", // にわとり 若どり もも 皮つき 生
  "11219", // にわとり 若どり むね 皮つき 生
  "11227", // にわとり 若どり ささみ 生
  "11230", // にわとり ひき肉 生
  "11123", // ぶた 大型種 ロース 脂身つき 生
  "11129", // ぶた 大型種 ばら 脂身つき 生
  "11163", // ぶた ひき肉 生
  "11034", // うし 乳用肥育 かたロース 脂身つき 生
  "11046", // うし 乳用肥育 ばら 脂身つき 生
  "11089", // うし ひき肉 生
  "10134", // しろさけ 生
  "10154", // まさば 生
  "10263", // まぐろ 缶詰 油漬 フレーク ライト（ツナ缶）
  "10381", // 焼き竹輪
  "01088", // 精白米 めし
  "01026", // 角形食パン
  "01039", // うどん ゆで
  "01047", // 中華めん 生
  "01015", // 薄力粉 1等
  "04032", // 木綿豆腐
  "04033", // 絹ごし豆腐
  "04039", // 生揚げ
  "04040", // 油揚げ 生
  "04046", // 糸引き納豆
  "02017", // じゃがいも 皮なし 生
  "06153", // たまねぎ 生
  "06214", // にんじん 皮なし 生
  "06061", // キャベツ 生
  "06134", // だいこん 皮なし 生
  "06226", // 根深ねぎ 生
  "06267", // ほうれんそう 生
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

// 食品名の正規化はキー入力のたびに全件ぶん繰り返すと重いので、食品ごとに1回だけ計算して覚えておく
// full: 食品名全体 / core: 分類の見出し（＜鳥肉類＞・（まぐろ類）・［豆腐・油揚げ類］など）を除いた部分
interface NormalizedName {
  full: string;
  core: string;
}
const normalizedNames = new WeakMap<Food, NormalizedName>();
function normalizedName(food: Food): NormalizedName {
  let n = normalizedNames.get(food);
  if (n === undefined) {
    n = {
      full: normalizeKana(food.name),
      core: normalizeKana(food.name.replace(/＜[^＞]*＞|（[^）]*）|［[^］]*］/g, " ")),
    };
    normalizedNames.set(food, n);
  }
  return n;
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

  // 名称のあいまい検索（かな・漢字・カタカナ・ローマ字）。
  // 空白で区切った語ごとに、「そのままの語」か「読み替えた語の並びをすべて」含む食品を探す
  // （「鶏卵」はそのまま、「鶏もも」は「にわとり」「もも」の両方を含む食品に当たる）。
  const romajiTerm = resolveRomaji(trimmed);
  const effectiveQuery = romajiTerm ?? trimmed;
  const terms = normalizeKeepSpaces(effectiveQuery)
    .split(/[　\s]+/)
    .filter(Boolean)
    .map((word) => {
      // exact: 語全体がそのまま読み替え表の別名（「鶏肉」「ツナ」など）。このときは読み替え先での一致を優先する。
      // そうでない語（「牛乳」→「うし」「乳」のように一部だけ読み替わる語）は文字どおりの一致を優先する
      return { word, expanded: expandAliases(word), exact: ALIAS_MAP.has(word) };
    });
  if (terms.length) {
    for (const food of foods) {
      if (seen.has(food.code)) continue;
      const { full: nname, core } = normalizedName(food);
      let penalty = 0;
      let hit = true;
      for (const { word, expanded, exact } of terms) {
        const literal = nname.includes(word);
        const aliased = expanded.every((w) => nname.includes(w));
        if (!literal && !aliased) {
          hit = false;
          break;
        }
        // 優先しない側でしか当たらない食品は後ろに回す。例: 「鳥肉」が「＜鳥肉類＞かも」に、
        // 「ツナ」が「こまつな」に文字どおり当たる／「牛乳」が「うし［乳用肥育牛肉］」に読み替えで当たる
        if (exact ? !aliased : !literal) penalty += 1000;
        // 分類の見出しにしか出てこない語で当たった食品も後ろに回す（「豆腐」で［豆腐・油揚げ類］の生揚げが先に出ないように）
        const inCore = core.includes(word) || expanded.every((w) => core.includes(w));
        if (!inCore) penalty += 500;
        // 逆に「（いか類）」のように語そのものが分類名になっている食品は前に出す（「いか」で「すいか」より先に）
        if (nname.includes(`${word}類`)) penalty -= 300;
      }
      if (hit) {
        const boost = PRIORITY_CODES.has(food.code) ? -100000 : 0;
        results.push({ food, score: boost + penalty + nname.length });
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
