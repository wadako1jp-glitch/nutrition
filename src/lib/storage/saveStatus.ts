// 保存に失敗したかどうかを画面に知らせる（容量不足・ブラウザの制限など）。
// 保存に失敗すると画面に注意を出し（src/components/SaveErrorBanner.tsx）、次に保存できた時点で消す。
type Listener = (failed: boolean) => void;

let failed = false;
const listeners = new Set<Listener>();

export function reportSaveResult(ok: boolean): void {
  if (failed === !ok) return;
  failed = !ok;
  listeners.forEach((l) => l(failed));
}

export function hasSaveFailed(): boolean {
  return failed;
}

// 変化を受け取る。戻り値を呼ぶと受け取りをやめる
export function subscribeSaveStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
