// 使用量(g)入力のバリデーション純粋関数。
// 要件: 数字バリデーションをつけ、数字以外は警告表示、全角数字は半角に変換して保存できるようにする。

// 全角数字・全角ピリオド/句点を半角に変換する（保存前に必ず通す）
export function normalizeWeightInput(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".");
}

// 正の数（整数 or 小数）として妥当か
export function isValidWeightNumber(normalized: string): boolean {
  return /^\d+(\.\d+)?$/.test(normalized) && parseFloat(normalized) > 0;
}

// 警告表示すべきか（未入力はOK。入力済みで数字として不正な場合のみ警告）
export function weightHasWarning(normalized: string): boolean {
  return normalized !== "" && !isValidWeightNumber(normalized);
}

// 警告メッセージ。原因（数字以外が混ざっている／0以下）によって文言を変える。
// 警告不要（空欄・妥当な値）なら null。
export function weightWarningMessage(normalized: string): string | null {
  if (normalized === "" || isValidWeightNumber(normalized)) return null;
  if (/^\d+(\.\d+)?$/.test(normalized)) return "0より大きい数値を入力してください";
  return "半角数字で入力してください";
}

// 計算に使う数値。"12a" のような不正値はparseFloatだと12として拾ってしまう（警告表示と矛盾する）ため、
// 妥当な数値のときだけ数値化し、それ以外は常に0として扱う。
export function weightValue(normalized: string): number {
  return isValidWeightNumber(normalized) ? parseFloat(normalized) : 0;
}
