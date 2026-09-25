// コードの書き方の自動チェック（ESLint）。`npm run lint` で実行し、PRのCIでも動く。
// 見た目の整形（改行・空白など）は Prettier の担当（`npm run format`）。ここでは、バグにつながりやすい書き方だけを見る。
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "node_modules", "public"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // React の約束ごと（useEffect などの使い方）。破ると画面の更新漏れ・無限ループになる
      ...reactHooks.configs.recommended.rules,
      // 全角スペース（食品名の区切り「＜鳥肉類＞　」など）は文字列・正規表現の中では正しい使い方なので許す
      "no-irregular-whitespace": ["error", { skipStrings: true, skipRegExps: true, skipTemplates: true, skipComments: true }],
    },
  },
);
