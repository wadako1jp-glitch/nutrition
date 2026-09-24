import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// 栄養計算アプリ: オフライン前提のPWA。
// 静的データ（成分表JSON等）とアプリ本体を丸ごとキャッシュし、
// 接続が弱い/無い環境でも起動・計算できるようにする。
// 配信パス。GitHub Pages のプロジェクトサイト（pepstech.pw/<リポジトリ名>/）で
// 公開するため、CIでは BASE_PATH にリポジトリ名を渡す。ローカル開発時は "/"。
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "栄養計算アプリ",
        short_name: "栄養計算",
        description: "食材を入れると栄養価計算用紙と同じ形式で栄養価を計算します",
        theme_color: "#1f1c18",
        background_color: "#f2f2f2",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // data/配下の成分表JSON等も含め、ビルド出力を丸ごとプリキャッシュする
        globPatterns: ["**/*.{js,css,html,json,png,svg,ico}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
