# 成分表の改訂版（九訂など）への切り替え手順

八訂（増補2023）から改訂版に切り替えるときの作業手順。コード側は版を1か所で切り替えられるようにしてあるので、
作業の中心はデータの取り込みと、食品番号が変わった食品の確認になる。

## 仕組み（下準備済み）
- **版の定義は `src/data/foodTable.ts` の1か所**。`CURRENT_FOOD_TABLE` が読み込むJSONと、画面の注記（「八訂（増補2023）ベース」等）を決める
- **献立は作成時の版を記録する**（`StoredMenu.foodTable`）。記録を始める前の献立は八訂（増補2023）として扱う。開き直して保存しても版は書き換えない
- **今の成分表に無い食品番号の行は消さない**。入力画面では表に出さず注記で件数と番号を示し、保存時はそのまま書き戻す（版を切り替えた直後に古い献立を開いても、データが失われない）
- **取り込みスクリプトは版ごとの設定を持つ**（`scripts/extract_foods.py` の `TABLES`）。`data/mext-tables/<版>/foods.json` と `public/data/<配信名>` の両方に書き出す

## 改訂の自動検知（.github/workflows/watch-food-table.yml）
- **毎週月曜 9:00（日本時間）** に GitHub Actions が文部科学省の成分表ページ（入口・今の版の配布ページ・食品成分データベース）を見て、`data/mext-tables/watch-baseline.json`（前回マージした時点の状態）と比べる。手動でも実行できる（Actions の「Watch food table」→ Run workflow）
- 変化があれば **ドラフトPR** を作る。PRには次のものが入る
  - 新しい基準（`watch-baseline.json` の更新）。マージすると同じ変化で再び通知されない
  - 新しい本表 Excel が出ていれば、その取り込み候補 `data/mext-tables/candidate-日付/`（`raw/` に配布ファイル、`foods.json`、差分レポート `report.md`）
  - 候補の表で今のテストを回した結果（通らないテストは、食品番号や名前が変わった箇所の目安）
- **版の切り替えは自動ではしない。** PRを見て、下の「切り替え手順」で人が行う（食品番号の対応や注記の見直しに判断が要るため）
- 初回は基準が無いので、「今の状態を基準として登録する」PRが1回だけ届く。マージしておく
- リポジトリの設定で「GitHub Actions による PR 作成」が無効だと PR を作れないため、代わりに Issue で知らせる（Settings → Actions → General → Workflow permissions → 「Allow GitHub Actions to create and approve pull requests」を有効にすると PR になる）
- ページを取れなかった週は Actions の実行が失敗扱いになり、GitHub から持ち主にメールが届く（誤って「変化あり」にはしない）
- Actions が作った PR では CI が自動で走らない（GitHub の仕様）。PR 本文のテスト結果を見るか、手元で `FOODS_JSON=data/mext-tables/candidate-日付/foods.json npm test` を回す

## 切り替え手順
1. 配布ファイル（Excel・PDF）を `data/mext-tables/<版>/raw/` に置く
2. `scripts/extract_foods.py` の `TABLES` に版（配布ファイル名と配信ファイル名）を追加する。列は Excel の成分識別子（ENERC_KCAL など）と見出しで自動的に探すので、列の並びが変わっても設定は要らない（識別子が見つからなければエラーで止まる）
3. `python3 scripts/extract_foods.py --version <版>` で JSON を作る
4. `src/data/foodTable.ts` の `FOOD_TABLES` に版を追加し、`CURRENT_FOOD_TABLE` を切り替える
5. 旧版と新版の食品番号を突き合わせ、**廃止・変更・意味が変わった番号**を洗い出す（`python3 scripts/diff_food_tables.py 旧.json 新.json` の差分レポート。自動検知のPRには最初から付いている）。必要なら旧→新の対応表を作り、読み込み時に置き換える
6. 読み替え表（`src/data/foodAliases.ts`）・`ROMAJI_ALIASES`・`PRIORITY_CODES`（よく使う食材の優先表示）を新しい食品名・番号で見直す。`npm test` の検索テストが、当たらなくなった別名や食材を一覧で教えてくれる
7. 食事摂取基準との関係の注記（`src/screens/DailySummary.tsx`）の文面が新しい版でも正しいか確認する
8. テスト・スクショで確認し、PR → マージ（main へのマージで自動公開）

## 注意
- 配信ファイル名は版ごとに変える（同名で上書きしない）。旧版と新版を並べて置け、切り替えや差し戻しが `foodTable.ts` の1行で済む
- 旧版のJSONは、対応表を作り終えるまで `data/mext-tables/<旧版>/` に残しておく
