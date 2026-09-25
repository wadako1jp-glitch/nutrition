"""2つの foods.json（今の版と新しい版の候補）を比べ、改訂で何が変わったかを Markdown で出す。

    python3 scripts/diff_food_tables.py 今の.json 候補の.json > report.md

人が版の切り替えを判断するための材料（docs/food-table-upgrade.md の手順5・6）:
食品番号の追加・廃止・名前の変更、廃棄率の変化、栄養成分値の変化、
アプリが食品番号を名指ししている箇所（優先表示の PRIORITY_CODES）への影響。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NUTRIENTS = ["kcal", "protein_g", "fat_g", "carb_g", "fiber_g", "ca_mg", "fe_mg", "va_ugRAE", "vd_ug",
             "vb1_mg", "vb2_mg", "vc_mg", "salt_g"]
LIMIT = 80  # 一覧に載せる最大件数（超えた分は件数だけ出す）


def value(c):
    if isinstance(c, dict):
        return c.get("value")
    return c


def name(f) -> str:
    return (f.get("name") or "").replace("　", " ")


def app_codes() -> set:
    """アプリのコードが食品番号を名指ししている箇所（検索の優先表示）。"""
    src = (ROOT / "src" / "data" / "foods.ts").read_text(encoding="utf-8")
    block = src[src.index("PRIORITY_CODES"):]
    block = block[: block.index("]);")]
    return set(re.findall(r'"(\d{5})"', block))


def table(rows, header) -> list:
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    for r in rows[:LIMIT]:
        out.append("| " + " | ".join(str(x).replace("|", "／") for x in r) + " |")
    if len(rows) > LIMIT:
        out.append(f"\n…ほか {len(rows) - LIMIT} 件")
    return out


def report(old: list, new: list) -> str:
    o = {f["code"]: f for f in old}
    n = {f["code"]: f for f in new}
    added = sorted(set(n) - set(o))
    removed = sorted(set(o) - set(n))
    common = sorted(set(o) & set(n))
    renamed = [(c, name(o[c]), name(n[c])) for c in common if name(o[c]) != name(n[c])]
    waste = [(c, name(n[c]), value(o[c]["waste_pct"]), value(n[c]["waste_pct"]))
             for c in common if value(o[c]["waste_pct"]) != value(n[c]["waste_pct"])]
    changed = {k: [] for k in NUTRIENTS}
    for c in common:
        for k in NUTRIENTS:
            a, b = value(o[c].get(k)), value(n[c].get(k))
            if a != b:
                changed[k].append((c, name(n[c]), a, b))
    nutrient_changes = sum(len(v) for v in changed.values())
    priority = app_codes()
    lost_priority = sorted(priority & set(removed))

    lines = ["## 成分表の改訂候補: 差分レポート", ""]
    lines += [f"- 食品数: {len(old)} → **{len(new)}**",
              f"- 追加された食品番号: **{len(added)}**",
              f"- なくなった食品番号: **{len(removed)}**（保存済みの献立では「見つからない食品」として残る）",
              f"- 名前が変わった食品: **{len(renamed)}**",
              f"- 廃棄率が変わった食品: **{len(waste)}**（発注量に影響）",
              f"- 栄養成分値の変化: **{nutrient_changes}** 件（{sum(1 for v in changed.values() if v)} 項目）",
              f"- 優先表示（PRIORITY_CODES）でなくなった番号: **{len(lost_priority)}**",
              ""]
    for label, key in (("めし・かゆの米換算", "raw_equiv"), ("おろしの換算", "grated"), ("皮つき⇔皮なしの対", "peel_alt")):
        lines.append(f"- {label}（発注量の買う形）: {sum(key in f for f in old)} → {sum(key in f for f in new)}")
    lines.append("")
    if lost_priority:
        lines += ["### 優先表示でなくなった番号（src/data/foods.ts の PRIORITY_CODES を直す）", ""]
        lines += table([(c, name(o[c])) for c in lost_priority], ["番号", "今の版の名前"]) + [""]
    if removed:
        lines += ["### なくなった食品番号（旧→新の対応表が要るか判断する）", ""]
        lines += table([(c, name(o[c])) for c in removed], ["番号", "今の版の名前"]) + [""]
    if added:
        lines += ["### 追加された食品番号", ""]
        lines += table([(c, name(n[c])) for c in added], ["番号", "名前"]) + [""]
    if renamed:
        lines += ["### 名前が変わった食品（同じ番号）", ""]
        lines += table(renamed, ["番号", "今の版", "新しい版"]) + [""]
    if waste:
        lines += ["### 廃棄率が変わった食品", ""]
        lines += table(waste, ["番号", "名前", "今の版(%)", "新しい版(%)"]) + [""]
    if nutrient_changes:
        lines += ["### 栄養成分値の変化（項目ごとの件数）", ""]
        lines += table([(k, len(v)) for k, v in changed.items() if v], ["項目", "件数"]) + [""]
        sample = [(k,) + x for k, v in changed.items() for x in v[:5]]
        lines += ["項目ごとに先頭5件の例:", ""]
        lines += table(sample, ["項目", "番号", "名前", "今の版", "新しい版"]) + [""]
    return "\n".join(lines)


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: diff_food_tables.py 今の.json 候補の.json")
    old = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    new = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    print(report(old, new))


if __name__ == "__main__":
    main()
