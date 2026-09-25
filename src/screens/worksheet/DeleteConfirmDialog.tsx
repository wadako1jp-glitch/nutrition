// 材料の行を消す前の確認ポップアップ（「削除する」「キャンセル」）。
// 「次から確認せずに削除する」にチェックして削除すると、以降は確認なしで消せる（⚙の設定で元に戻せる）。
import { useState } from "react";

export default function DeleteConfirmDialog({
  foodName,
  onCancel,
  onConfirm,
}: {
  foodName: string;
  onCancel: () => void;
  onConfirm: (skipNextTime: boolean) => void; // skipNextTime = 次から確認しない
}) {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-title">「{foodName}」を削除しますか？</div>
        <label className="confirm-skip">
          <input type="checkbox" checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)} />
          次から確認せずに削除する（連続で消せます。⚙の設定で元に戻せます）
        </label>
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="confirm-delete" onClick={() => onConfirm(dontAskAgain)}>
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
