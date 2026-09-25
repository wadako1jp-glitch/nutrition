// 保存に失敗したときに画面の下に出す注意（どの画面でも出る）。次に保存できたら自動で消える。
// 保存の成否は src/lib/storage/saveStatus.ts から受け取る。
import { useEffect, useState } from "react";
import { hasSaveFailed, subscribeSaveStatus } from "../lib/storage/saveStatus";

export default function SaveErrorBanner() {
  const [failed, setFailed] = useState(hasSaveFailed);
  useEffect(() => subscribeSaveStatus(setFailed), []);
  if (!failed) return null;
  return (
    <div className="save-error-banner" role="alert">
      ⚠ 保存できませんでした（端末の空き容量不足・ブラウザの制限など）。この画面を閉じると入力が消えるおそれがあります。
      画像用表示で控えを残してください。内容を変えると、もう一度保存を試みます。
    </div>
  );
}
