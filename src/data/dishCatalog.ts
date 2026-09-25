// 料理データ（献立名の自動付けに使う。今後、献立の検索・取り込みにも使う）。
// 出所: AI（Claude）が一般的な家庭料理・給食料理として作成し、人が確認したもの。分量は1人分の「目安」で、公式の献立ではない。
//
// 書き方:
// - words: 食品名の語。どれか1つに当たればよい。食品名の語と同じか、その語で終わるものに当たる
//   （「しょうゆ」→ こいくちしょうゆ・うすくちしょうゆ、「豆腐」→ 木綿豆腐・絹ごし豆腐）。
//   「ねぎ」だと「たまねぎ」にも当たってしまうので「根深ねぎ」のように具体的に書く
// - role: main（これが無いとその料理とは言えない材料）/ sub（入っていることが多い材料）/ seasoning（調味料）
// - code: 取り込むときに使う代表の食品番号。g: 1人分の目安(g)
// 料理を足したら npm test で、食品番号が実在するか・words に当たるかを確かめられる（tests/dishName.test.ts）。
import type { CatalogDish } from "../core/dishName";

const 肉 = ["うし", "ぶた", "にわとり"];
const 砂糖 = ["上白糖", "三温糖", "グラニュー糖"];

export const DISH_CATALOG: CatalogDish[] = [
  // --- 主菜 ---
  {
    name: "肉じゃが",
    category: "主菜",
    ingredients: [
      { words: ["じゃがいも"], role: "main", code: "02017", g: 60 },
      { words: ["うし", "ぶた"], role: "main", code: "11034", g: 30 },
      { words: ["たまねぎ"], role: "sub", code: "06153", g: 30 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 15 },
      { words: ["しらたき"], role: "sub", code: "02005", g: 15 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 6 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 3 },
      { words: ["みりん"], role: "seasoning", code: "16025", g: 3 },
    ],
  },
  {
    name: "筑前煮",
    category: "主菜",
    ingredients: [
      { words: ["にわとり"], role: "main", code: "11221", g: 40 },
      { words: ["ごぼう"], role: "main", code: "06084", g: 15 },
      { words: ["れんこん"], role: "main", code: "06317", g: 15 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 15 },
      { words: ["さといも"], role: "sub", code: "02010", g: 20 },
      { words: ["しいたけ"], role: "sub", code: "08039", g: 5 },
      { words: ["こんにゃく"], role: "sub", code: "02003", g: 15 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 6 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 3 },
      { words: ["みりん"], role: "seasoning", code: "16025", g: 3 },
    ],
  },
  {
    name: "豚肉のしょうが焼き",
    category: "主菜",
    ingredients: [
      { words: ["ぶた"], role: "main", code: "11123", g: 60 },
      { words: ["しょうが"], role: "main", code: "06103", g: 3 },
      { words: ["たまねぎ"], role: "sub", code: "06153", g: 30 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 6 },
      { words: ["みりん"], role: "seasoning", code: "16025", g: 4 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 3 },
    ],
  },
  {
    name: "鶏のから揚げ",
    category: "主菜",
    ingredients: [
      { words: ["にわとり"], role: "main", code: "11221", g: 70 },
      { words: ["でん粉", "小麦粉"], role: "main", code: "02034", g: 8 },
      { words: ["しょうが"], role: "sub", code: "06103", g: 2 },
      { words: ["にんにく"], role: "sub", code: "06223", g: 1 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 6 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 8 },
    ],
  },
  {
    name: "さばのみそ煮",
    category: "主菜",
    ingredients: [
      { words: ["さば"], role: "main", code: "10154", g: 70 },
      { words: ["みそ"], role: "main", code: "17045", g: 8 },
      { words: ["しょうが"], role: "sub", code: "06103", g: 3 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 4 },
      { words: ["清酒"], role: "seasoning", code: "16001", g: 5 },
    ],
  },
  {
    name: "鮭の塩焼き",
    category: "主菜",
    ingredients: [
      { words: ["さけ"], role: "main", code: "10134", g: 70 },
      { words: ["食塩"], role: "seasoning", code: "17012", g: 0.5 },
    ],
  },
  {
    name: "ハンバーグ",
    category: "主菜",
    ingredients: [
      { words: ["ひき肉"], role: "main", code: "11089", g: 60 },
      { words: ["たまねぎ"], role: "main", code: "06153", g: 30 },
      { words: ["パン粉"], role: "sub", code: "01079", g: 5 },
      { words: ["鶏卵"], role: "sub", code: "12004", g: 8 },
      { words: ["牛乳"], role: "sub", code: "13003", g: 5 },
      { words: ["ケチャップ"], role: "seasoning", code: "17036", g: 8 },
      { words: ["食塩"], role: "seasoning", code: "17012", g: 0.3 },
    ],
  },
  {
    name: "麻婆豆腐",
    category: "主菜",
    ingredients: [
      { words: ["豆腐"], role: "main", code: "04032", g: 100 },
      { words: ["ひき肉"], role: "main", code: "11163", g: 30 },
      { words: ["根深ねぎ", "こねぎ"], role: "sub", code: "06226", g: 10 },
      { words: ["にんにく"], role: "sub", code: "06223", g: 1 },
      { words: ["しょうが"], role: "sub", code: "06103", g: 1 },
      { words: ["トウバンジャン"], role: "seasoning", code: "17004", g: 1 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 5 },
      { words: ["でん粉"], role: "seasoning", code: "02034", g: 2 },
      { words: ["ごま油"], role: "seasoning", code: "14002", g: 2 },
    ],
  },
  {
    name: "酢豚",
    category: "主菜",
    ingredients: [
      { words: ["ぶた"], role: "main", code: "11123", g: 50 },
      { words: ["たまねぎ"], role: "main", code: "06153", g: 30 },
      { words: ["ピーマン"], role: "main", code: "06245", g: 15 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 15 },
      { words: ["酢"], role: "seasoning", code: "17015", g: 8 },
      { words: ["ケチャップ"], role: "seasoning", code: "17036", g: 10 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 5 },
      { words: ["でん粉"], role: "seasoning", code: "02034", g: 5 },
    ],
  },
  {
    name: "八宝菜",
    category: "主菜",
    ingredients: [
      { words: ["はくさい"], role: "main", code: "06233", g: 60 },
      { words: ["ぶた"], role: "main", code: "11123", g: 30 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
      { words: ["えび", "いか"], role: "sub", code: "10415", g: 15 },
      { words: ["しいたけ"], role: "sub", code: "08039", g: 5 },
      { words: ["でん粉"], role: "seasoning", code: "02034", g: 3 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 4 },
      { words: ["ごま油"], role: "seasoning", code: "14002", g: 2 },
    ],
  },
  {
    name: "野菜炒め",
    category: "主菜",
    ingredients: [
      { words: ["キャベツ"], role: "main", code: "06061", g: 60 },
      { words: ["もやし"], role: "main", code: "06291", g: 40 },
      { words: ["ぶた"], role: "sub", code: "11123", g: 30 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
      { words: ["ピーマン"], role: "sub", code: "06245", g: 10 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 4 },
      { words: ["食塩"], role: "seasoning", code: "17012", g: 0.5 },
    ],
  },
  {
    name: "ぎょうざ",
    category: "主菜",
    ingredients: [
      { words: ["ぎょうざの皮"], role: "main", code: "01074", g: 30 },
      { words: ["ひき肉"], role: "main", code: "11163", g: 30 },
      { words: ["キャベツ", "はくさい"], role: "sub", code: "06061", g: 40 },
      { words: ["にら"], role: "sub", code: "06207", g: 10 },
      { words: ["にんにく"], role: "sub", code: "06223", g: 1 },
      { words: ["ごま油"], role: "seasoning", code: "14002", g: 2 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 3 },
    ],
  },
  {
    name: "ゴーヤチャンプルー",
    category: "主菜",
    ingredients: [
      { words: ["にがうり"], role: "main", code: "06205", g: 50 },
      { words: ["豆腐"], role: "main", code: "04032", g: 60 },
      { words: ["鶏卵"], role: "sub", code: "12004", g: 25 },
      { words: ["ぶた"], role: "sub", code: "11123", g: 30 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 4 },
    ],
  },
  {
    name: "すき焼き",
    category: "主菜",
    ingredients: [
      { words: ["うし"], role: "main", code: "11034", g: 70 },
      { words: ["豆腐"], role: "main", code: "04032", g: 60 },
      { words: ["根深ねぎ"], role: "sub", code: "06226", g: 30 },
      { words: ["しらたき"], role: "sub", code: "02005", g: 30 },
      { words: ["しゅんぎく"], role: "sub", code: "06099", g: 20 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 10 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 6 },
    ],
  },
  {
    name: "とんかつ",
    category: "主菜",
    ingredients: [
      { words: ["ぶた"], role: "main", code: "11123", g: 90 },
      { words: ["パン粉"], role: "main", code: "01079", g: 10 },
      { words: ["小麦粉"], role: "sub", code: "01015", g: 5 },
      { words: ["鶏卵"], role: "sub", code: "12004", g: 10 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 10 },
    ],
  },
  {
    name: "クリームシチュー",
    category: "主菜",
    ingredients: [
      { words: ["にわとり"], role: "main", code: "11221", g: 50 },
      { words: ["牛乳"], role: "main", code: "13003", g: 100 },
      { words: ["じゃがいも"], role: "sub", code: "02017", g: 50 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 20 },
      { words: ["たまねぎ"], role: "sub", code: "06153", g: 40 },
      { words: ["小麦粉"], role: "seasoning", code: "01015", g: 6 },
      { words: ["バター"], role: "seasoning", code: "14017", g: 5 },
    ],
  },
  {
    name: "グラタン",
    category: "主菜",
    ingredients: [
      { words: ["マカロニ・スパゲッティ"], role: "main", code: "01063", g: 15 },
      { words: ["牛乳"], role: "main", code: "13003", g: 100 },
      { words: ["チーズ"], role: "main", code: "13040", g: 10 },
      { words: ["たまねぎ"], role: "sub", code: "06153", g: 30 },
      { words: ["小麦粉"], role: "seasoning", code: "01015", g: 6 },
      { words: ["バター"], role: "seasoning", code: "14017", g: 6 },
    ],
  },

  // --- 主食（ご飯・めんを含む一品料理） ---
  // ご飯を別に盛る献立が多いので、「ご飯＋肉＋たまねぎ」だけで決まる料理（牛丼・チャーハン等）は入れない
  // （別盛りのご飯と肉じゃがを「牛丼」と取り違えるため）
  {
    name: "カレーライス",
    category: "主食",
    ingredients: [
      { words: ["カレールウ"], role: "main", code: "17051", g: 20 },
      { words: ["こめ"], role: "sub", code: "01088", g: 200 },
      { words: ["じゃがいも"], role: "sub", code: "02017", g: 50 },
      { words: ["たまねぎ"], role: "sub", code: "06153", g: 50 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 20 },
      { words: 肉, role: "sub", code: "11123", g: 40 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 3 },
    ],
  },
  {
    name: "親子丼",
    category: "主食",
    ingredients: [
      { words: ["にわとり"], role: "main", code: "11221", g: 50 },
      { words: ["鶏卵"], role: "main", code: "12004", g: 50 },
      { words: ["たまねぎ"], role: "main", code: "06153", g: 40 },
      { words: ["こめ"], role: "sub", code: "01088", g: 250 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 8 },
      { words: ["みりん"], role: "seasoning", code: "16025", g: 6 },
      { words: ["だし"], role: "seasoning", code: "17021", g: 50 },
    ],
  },
  {
    name: "オムライス",
    category: "主食",
    ingredients: [
      { words: ["こめ"], role: "main", code: "01088", g: 180 },
      { words: ["鶏卵"], role: "main", code: "12004", g: 50 },
      { words: ["ケチャップ"], role: "main", code: "17036", g: 20 },
      { words: ["にわとり"], role: "sub", code: "11221", g: 30 },
      { words: ["たまねぎ"], role: "sub", code: "06153", g: 30 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 5 },
    ],
  },
  {
    name: "焼きそば",
    category: "主食",
    ingredients: [
      { words: ["中華めん"], role: "main", code: "01049", g: 150 },
      { words: ["ウスターソース"], role: "main", code: "17001", g: 15 },
      { words: ["キャベツ"], role: "sub", code: "06061", g: 50 },
      { words: ["ぶた"], role: "sub", code: "11123", g: 30 },
      { words: ["もやし"], role: "sub", code: "06291", g: 30 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 5 },
    ],
  },
  {
    name: "ミートソーススパゲッティ",
    category: "主食",
    ingredients: [
      { words: ["マカロニ・スパゲッティ"], role: "main", code: "01063", g: 90 },
      { words: ["ひき肉"], role: "main", code: "11089", g: 40 },
      { words: ["ケチャップ"], role: "main", code: "17036", g: 20 },
      { words: ["たまねぎ"], role: "sub", code: "06153", g: 30 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
    ],
  },
  {
    name: "きつねうどん",
    category: "主食",
    ingredients: [
      { words: ["うどん"], role: "main", code: "01039", g: 200 },
      { words: ["油揚げ"], role: "main", code: "04040", g: 20 },
      { words: ["根深ねぎ", "こねぎ"], role: "sub", code: "06226", g: 5 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 10 },
      { words: ["だし"], role: "seasoning", code: "17021", g: 200 },
    ],
  },

  // --- 副菜 ---
  {
    name: "ほうれん草のおひたし",
    category: "副菜",
    ingredients: [
      { words: ["ほうれんそう"], role: "main", code: "06267", g: 60 },
      { words: ["かつお節"], role: "sub", code: "10091", g: 1 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 3 },
    ],
  },
  {
    name: "ほうれん草のごま和え",
    category: "副菜",
    ingredients: [
      { words: ["ほうれんそう"], role: "main", code: "06267", g: 60 },
      { words: ["ごま"], role: "main", code: "05018", g: 3 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 2 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 3 },
    ],
  },
  {
    name: "白和え",
    category: "副菜",
    ingredients: [
      { words: ["豆腐"], role: "main", code: "04032", g: 30 },
      { words: ["ごま"], role: "main", code: "05018", g: 3 },
      { words: ["ほうれんそう", "こまつな"], role: "sub", code: "06267", g: 30 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
      { words: ["こんにゃく"], role: "sub", code: "02003", g: 10 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 3 },
    ],
  },
  {
    name: "きんぴらごぼう",
    category: "副菜",
    ingredients: [
      { words: ["ごぼう"], role: "main", code: "06084", g: 40 },
      { words: ["にんじん"], role: "main", code: "06214", g: 10 },
      { words: ["ごま"], role: "sub", code: "05018", g: 1 },
      { words: ["ごま油"], role: "seasoning", code: "14002", g: 2 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 5 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 3 },
    ],
  },
  {
    name: "ひじきの煮物",
    category: "副菜",
    ingredients: [
      { words: ["ひじき"], role: "main", code: "09050", g: 5 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
      { words: ["油揚げ"], role: "sub", code: "04040", g: 10 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 4 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 3 },
      { words: ["調合油"], role: "seasoning", code: "14006", g: 2 },
    ],
  },
  {
    name: "切り干し大根の煮物",
    category: "副菜",
    ingredients: [
      { words: ["切干しだいこん"], role: "main", code: "06136", g: 10 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
      { words: ["油揚げ"], role: "sub", code: "04040", g: 10 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 4 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 3 },
    ],
  },
  {
    name: "ポテトサラダ",
    category: "副菜",
    ingredients: [
      { words: ["じゃがいも"], role: "main", code: "02017", g: 60 },
      { words: ["マヨネーズ"], role: "main", code: "17042", g: 10 },
      { words: ["きゅうり"], role: "sub", code: "06065", g: 15 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
      { words: ["たまねぎ"], role: "sub", code: "06153", g: 10 },
      { words: ["ハム"], role: "sub", code: "11176", g: 10 },
    ],
  },
  {
    name: "マカロニサラダ",
    category: "副菜",
    ingredients: [
      { words: ["マカロニ・スパゲッティ"], role: "main", code: "01063", g: 15 },
      { words: ["マヨネーズ"], role: "main", code: "17042", g: 10 },
      { words: ["きゅうり"], role: "sub", code: "06065", g: 15 },
      { words: ["ハム"], role: "sub", code: "11176", g: 10 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 5 },
    ],
  },
  {
    name: "きゅうりとわかめの酢の物",
    category: "副菜",
    ingredients: [
      { words: ["きゅうり"], role: "main", code: "06065", g: 40 },
      { words: ["わかめ"], role: "main", code: "09041", g: 10 },
      { words: ["酢"], role: "seasoning", code: "17015", g: 6 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 3 },
    ],
  },
  {
    name: "コールスロー",
    category: "副菜",
    ingredients: [
      { words: ["キャベツ"], role: "main", code: "06061", g: 50 },
      { words: ["マヨネーズ"], role: "main", code: "17042", g: 8 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
      { words: ["酢"], role: "seasoning", code: "17015", g: 3 },
    ],
  },
  {
    name: "かぼちゃの煮物",
    category: "副菜",
    ingredients: [
      { words: ["かぼちゃ"], role: "main", code: "06048", g: 70 },
      { words: ["しょうゆ"], role: "seasoning", code: "17007", g: 4 },
      { words: 砂糖, role: "seasoning", code: "03003", g: 4 },
    ],
  },
  {
    name: "もやしのナムル",
    category: "副菜",
    ingredients: [
      { words: ["もやし"], role: "main", code: "06291", g: 50 },
      { words: ["ごま油"], role: "main", code: "14002", g: 2 },
      { words: ["ごま"], role: "sub", code: "05018", g: 1 },
      { words: ["食塩"], role: "seasoning", code: "17012", g: 0.3 },
    ],
  },

  // --- 汁物 ---
  {
    name: "みそ汁",
    category: "汁物",
    ingredients: [
      { words: ["みそ"], role: "main", code: "17045", g: 10 },
      { words: ["豆腐", "わかめ", "油揚げ", "根深ねぎ", "こねぎ", "だいこん", "はくさい"], role: "main", code: "04032", g: 30 },
      { words: ["だし"], role: "sub", code: "17021", g: 150 },
    ],
  },
  {
    name: "豚汁",
    category: "汁物",
    ingredients: [
      { words: ["ぶた"], role: "main", code: "11123", g: 30 },
      { words: ["みそ"], role: "main", code: "17045", g: 10 },
      { words: ["だいこん"], role: "main", code: "06134", g: 30 },
      { words: ["にんじん"], role: "sub", code: "06214", g: 10 },
      { words: ["ごぼう"], role: "sub", code: "06084", g: 10 },
      { words: ["さといも"], role: "sub", code: "02010", g: 20 },
      { words: ["こんにゃく"], role: "sub", code: "02003", g: 15 },
      { words: ["根深ねぎ", "こねぎ"], role: "sub", code: "06226", g: 5 },
      { words: ["だし"], role: "sub", code: "17021", g: 150 },
    ],
  },
];
