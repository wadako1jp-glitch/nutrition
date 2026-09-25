// ブラウザに「このアプリのデータを消さないで」と頼む（navigator.storage.persist）。
// 空き容量が減ったときなどに、ブラウザが保存データを自動で消す対象から外してもらうため。
// 認めるかどうかはブラウザが決める（ホーム画面に追加したアプリは認められやすい）。
// 献立をはじめて保存したときに1回だけ頼む（起動直後に頼むと、ブラウザによっては確認が出て邪魔なため）。
let asked = false;

export function askToKeepData(): void {
  if (asked) return;
  asked = true;
  const s = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!s?.persist || !s.persisted) return;
  s.persisted()
    .then((already) => (already ? true : s.persist()))
    .catch(() => {});
}
