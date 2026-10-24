# コードの地図 — どこを直せば何が変わるか

エンジニアでない人が「この部分を変えたい」と思ったときに、どのファイルを見ればよいかをまとめた表です。
ファイルの先頭には、そのファイルが何をするかが日本語で書いてあります。まずはそこを読んでください。

仕様（なぜそうなっているか）は `CLAUDE.md`、成分表の改訂手順は `docs/food-table-upgrade.md` にあります。

---

## 1. 全体の形

```
画面（見た目と操作）      src/screens/ , src/features/
   │  数字を出すときは ↓ を呼ぶだけ
計算ルール（純粋な計算）   src/core/
   │  食品のデータは ↓ から
成分表・基準値のデータ     src/data/ , public/data/ , data/
   │
端末への保存              src/lib/storage/
```

- **計算は `src/core/` だけ**に書いてあります。画面のファイルでは計算しません。
  - だから「計算が合わない」ときは `src/core/` を、「見た目がおかしい」ときは画面のファイルを見れば済みます。
- **見た目（色・大きさ・並び・縦持ち/横持ちの切り替え）は、ほぼ全部 `src/styles.css`** にあります。
  - ファイルの中は `/* --- 献立一覧ページ --- */` のような見出しで区切ってあります。
- サーバーはありません。成分表は最初に1回読み込みます。入力した献立はスマホの中（ブラウザ）に保存されます。

## 2. 画面ごとのファイル

| 画面 | ファイル |
|---|---|
| 画面の切り替え（一覧 ⇄ 入力 ⇄ 合計 ⇄ 設定） | `src/App.tsx` |
| 画面ごとのURL（スマホの「戻る」で前の画面へ） | `src/lib/route.ts`（URLと画面の対応表）、`src/hooks/useRoute.ts`（履歴の操作） |
| 献立一覧（最初の画面） | `src/screens/MenuList.tsx` |
| 入力画面（材料表） | `src/screens/worksheet/` のフォルダ一式（下の表） |
| 発注量 | `src/features/order-quantity/OrderView.tsx` |
| 合計・充足率 | `src/screens/DailySummary.tsx` |
| プロフィール・設定（⚙） | `src/screens/ProfileEdit.tsx` |

入力画面のフォルダ `src/screens/worksheet/` の中身:

| ファイル | 担当 |
|---|---|
| `Worksheet.tsx` | まとめ役。献立の読み込み・自動保存、材料の追加・変更・削除、上部のボタン（←・献立名・発注量・画像用表示） |
| `AddCard.tsx` | 材料追加欄（食品名の検索候補・使用量・料理タグ・「材料を追加」） |
| `SheetTable.tsx` | 材料表そのもの（各行・料理タグごとの小計・献立の小計） |
| `DeleteConfirmDialog.tsx` | 「×」を押したときの削除確認 |
| `ExportView.tsx` | 画像用表示（提出・共有用の横長の表と「共有」ボタン） |
| `DishSelect.tsx` | 料理タグのプルダウン（「＋自由入力…」を含む） |
| `MenuTitleSelect.tsx` | 献立名のプルダウン（自動／料理名・朝食…で固定） |
| `useWideChrome.ts` | 横持ちのとき、ツールバーと材料追加欄を数秒で隠す仕組み |
| `rows.ts` | 材料1行の形（食品・使用量・タグ）などの共通部分 |

## 3. やりたいこと → 触るファイル

### 文言・見た目

| やりたいこと | ファイル | 目印 |
|---|---|---|
| ボタンや注意書きの文言を変える | その画面のファイル（上の表） | 画面に出ている文字でファイル内を検索する |
| 色・文字の大きさ・余白を変える | `src/styles.css` | 見出しコメントで場所を探す |
| 材料名の列の幅・折り返し行数 | `src/styles.css` | 「入力用の表（縦持ち）」の見出し。**半分未満・3行以上にはしない**（CLAUDE.md） |
| 横持ちに切り替わる画面幅 | `src/styles.css` の `@media` と `src/hooks/useMediaQuery.ts` の `WIDE_QUERY` | **2か所を必ず同じ値にする** |
| 横持ちでツールバーが隠れるまでの秒数 | `src/screens/worksheet/useWideChrome.ts` | `HIDE_AFTER_MS`（ミリ秒。4000 = 4秒） |
| 保存に失敗したときの注意の文言・見た目 | `src/components/SaveErrorBanner.tsx`、`src/styles.css` | 「保存に失敗したとき」の見出し |
| 画面のURLの形を変える・画面を足す | `src/lib/route.ts` | 先頭の対応表と `parseRoute`・`formatRoute`。`tests/route.test.ts` も足す |
| アプリ名・アイコン（ホーム画面に追加したとき） | `vite.config.ts` の `manifest`、`public/icon-*.png` | |

### 表の項目・計算

| やりたいこと | ファイル | 目印 |
|---|---|---|
| 栄養素の列（項目・順番・見出し・単位） | `src/core/nutrition.ts` | `NUTRIENT_KEYS`（並び）と `NUTRIENT_LABELS`（見出しと単位） |
| 丸め方・小計の出し方 | `src/core/nutrition.ts` | `round1`・`sumRows`。**行ごとに丸めてから合計**（CLAUDE.md） |
| 使用量の入力チェック（全角→半角、警告の文言） | `src/core/weightInput.ts` | |
| 料理タグの選択肢（主食・主菜…） | `src/core/dishes.ts` | `DISH_PRESETS` |
| 献立名の区分（朝食・昼食…）・時刻からの推定 | `src/core/menuTitle.ts` | `MEALS`・`guessMeal` |
| 献立名に付く料理（料理を足す・材料を直す） | `src/data/dishCatalog.ts` | 先頭の「書き方」に従って1品足す。`npm test` で食品番号と取り違えを確かめられる |
| 料理名の推定の仕方（当たりやすさ・「他」の付け方） | `src/core/dishName.ts` | 設計は `docs/design/recipes-and-dish-names.md` |
| 発注量の計算・人数の上限 | `src/core/order.ts` | `MAX_SERVINGS` |
| 充足率の判定（不足・目標範囲・超過） | `src/core/intake.ts` | |
| 食事摂取基準の数値 | `src/data/dri/2025.ts` | 版ごとにファイルを分けている |
| 画像（共有するPNG）の中身 | `src/features/export-image/exportSheet.ts` | 「何を載せるか」 |
| 画像（共有するPNG）の見た目 | `src/features/export-image/drawExportSheet.ts` | 「どう描くか」。画面の画像用表示と見た目を揃える |

### 食品の検索・成分表

| やりたいこと | ファイル | 目印 |
|---|---|---|
| 検索で見つからない食品を見つかるようにする（別名の追加） | `src/data/foodAliases.ts` | 先頭の「書き方のルール」に従って1行足す |
| 検索候補の並び順（よく使う食品を上に） | `src/data/foods.ts` | `PRIORITY_CODES`・`searchFoods` |
| 使う成分表の版を切り替える（九訂など） | `src/data/foodTable.ts` | `CURRENT_FOOD_TABLE`。手順は `docs/food-table-upgrade.md` |
| 成分表のExcelからアプリ用データを作る | `scripts/extract_foods.py` | 作ったデータは `public/data/` にも書き出される |

## 4. データの置き場所

| 場所 | 中身 |
|---|---|
| `data/mext-tables/<版>/` | 文科省の成分表（元のExcelと、そこから作った `foods.json`） |
| `public/data/` | アプリが実際に読み込む成分表（上から作ったもの）。オフラインでも使えるよう丸ごと保存される |
| `data/samples/` | 用紙の写真（学籍番号・氏名が写っているため **GitHubには上げない**。`.gitignore` 済み） |
| スマホの中（ブラウザの localStorage） | 献立・プロフィール・設定。何を保存するかは `src/lib/storage/` の `menus.ts`・`profile.ts`・`settings.ts`、どう保存するかは同じフォルダの `index.ts` |

## 5. 自動で動いているもの（`.github/workflows/`）

| ファイル | いつ | 何をする |
|---|---|---|
| `ci.yml` | PRを出したとき | 書き方・書式・テスト・ビルドが通るか確かめる。赤（失敗）ならマージしない |
| `deploy.yml` | main にマージしたとき | 公開中のアプリを更新する（数分で反映） |
| `watch-food-table.yml` | 毎週月曜 | 文科省のページを見て、成分表の改訂があれば取り込み候補のPRを作る。**切り替えは人が判断する** |

## 6. 変えたあとの確かめ方

| 確かめること | コマンド |
|---|---|
| 計算・検索などのテスト（`tests/` にある） | `npm test` |
| 型のチェックと本番用の組み立て | `npm run build` |
| 手元で画面を見る（表示されたURLをブラウザで開く） | `npm run dev` |
| 成分表ツールのテスト | `python3 -m unittest discover -s tests/python` |
| 書き方の自動チェック（バグにつながりやすい書き方を見つける。設定は `eslint.config.js`） | `npm run lint` |
| 書式（改行・空白）をそろえる／そろっているか確かめる（設定は `.prettierrc.json`。`styles.css` は対象外） | `npm run format` ／ `npm run format:check` |

PRを出せば同じチェックが自動で走ります（上の `ci.yml`）。書式のチェックで落ちたときは、`npm run format` を実行してコミットし直せば直ります。

## 7. 変えるときに守ること（CLAUDE.md より、壊れやすい所）

- **縦持ち/横持ちの切り替えは `styles.css` だけで行う。**
  - 画面のファイルで「狭い版」「広い版」を出し分けると、入力中の文字が消えます。
- 計算は `src/core/` に書く。画面のファイルに計算を書かない。
- 長押し・スワイプの操作は使わない（過去に試して使いにくかった）。
- 廃棄率は発注量にだけ使い、栄養計算には使わない。

## 8. 今は使っていないもの

- `scripts/check_sample_terms.py`・`check_sample_terms2.py`・`scripts/synonyms.py`・`data/synonyms/`
  - 初期に用紙の語句が検索で見つかるかを確かめた時の道具です。
  - アプリの検索は `src/data/foodAliases.ts` を使っています。
- `src/features/salt-ratio/`（料理区分ごとの塩分%）
  - CLAUDE.md に予定として書かれていますが、まだ作っていません。
