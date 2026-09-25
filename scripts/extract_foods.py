"""成分表（文科省配布のExcel）から、アプリが読む foods.json を作る。

版ごとに data/mext-tables/<版>/raw/ に配布ファイルを置き、次のように実行する（引数なしは現行の八訂・増補2023）:

    python3 scripts/extract_foods.py --version 2023_増補 \
        --xlsx 20260327-mxt_kagsei-mext-000029402_02.xlsx --public-name foods.2023-zouho.json

出力:
  - data/mext-tables/<版>/foods.json   … 版ごとの保管用
  - public/data/<public-name>          … アプリが実際に配信・読み込むファイル（src/data/foodTable.ts の file と揃える）

改訂版で列の並びが変わった場合は COLS を版ごとに用意する。手順は docs/food-table-upgrade.md を参照。
"""
import argparse
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent

# 版 -> 取り込み設定。シート名・見出し行数・列位置（0始まり）は配布ファイルの形式に合わせる
TABLES = {
    "2023_増補": {
        "xlsx": "20260327-mxt_kagsei-mext-000029402_02.xlsx",
        "public_name": "foods.2023-zouho.json",
        "sheet": "表全体",
        "first_row": 13,
        "cols": {
            "group": 0, "code": 1, "index": 2, "name": 3, "waste_pct": 4,
            "kcal": 6, "protein_g": 9, "fat_g": 12, "carb_g": 20, "fiber_g": 18,
            "ca_mg": 25, "fe_mg": 28, "va_ugRAE": 42, "vd_ug": 43,
            "vb1_mg": 49, "vb2_mg": 50, "vc_mg": 58, "salt_g": 60,
        },
        "note_col": 61,  # 備考。「廃棄部位： …」の行から廃棄部位を取り出す
    },
}


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        if s in ("", "-"):
            return None
        if s == "Tr":
            return {"value": 0, "flag": "Tr"}
        m = re.fullmatch(r"\(([-\d.]+)\)", s)
        if m:
            return {"value": float(m.group(1)), "flag": "推定値"}
        try:
            return float(s)
        except ValueError:
            return {"value": None, "flag": s}
    return v


def waste_part(note) -> str | None:
    """備考から「廃棄部位： 皮、へた」の「皮、へた」部分を取り出す（無ければ None）。"""
    if not isinstance(note, str):
        return None
    m = re.search(r"廃棄部位\s*[：:]\s*([^\n]+)", note)
    if m:
        return m.group(1).strip()
    # らっかせい等は「廃棄率： 殻 26 % 及び種皮 4 %」の形で部位ごとの内訳を書いている
    m = re.search(r"廃棄率\s*[：:]\s*([^\n]+)", note)
    return m.group(1).strip() if m else None


def raw_equiv(name: str, note) -> dict | None:
    """めし・かゆ等: 備考「精白米47 g相当量を含む」→ 可食部100 g当たりに含まれる、炊く前の米の重さ。"""
    if not isinstance(note, str):
        return None
    m = re.search(r"([^\s\n、。]*?)\s*(\d+(?:\.\d+)?)\s*g\s*相当量を含む", note)
    if not m:
        return None
    base = m.group(1)
    if base == "乾":  # おおむぎ 押麦 めし「乾35 g相当量を含む」→「押麦 乾」
        words = [w for w in name.split("\u3000") if w and not w.startswith(("＜", "（", "［"))]
        base = "\u3000".join(words[:-1] + ["乾"])
    return {"label": base, "g_per_100g": float(m.group(2))}


def link_derived(foods: list, notes: dict) -> None:
    """元の食品へのつながりを付ける（発注量で「買う形」を示すため）。
    - おろし: 備考「全体に対する割合24 %」と、おろす前の食品（名前から「おろし…」を除いたもの）の廃棄率
    - 皮つき/皮なし: 名前の「皮つき」「皮なし」だけが違う食品の廃棄率
    """
    by_name = {f["name"]: f for f in foods}
    for f in foods:
        note = notes.get(f["code"]) or ""
        words = f["name"].split("\u3000")
        m = re.search(r"全体に対する割合\s*(\d+(?:\.\d+)?)\s*%", note)
        if m and words[-1].startswith("おろし"):
            src = by_name.get("\u3000".join(words[:-1]))
            if src is not None:
                f["grated"] = {"ratio_pct": float(m.group(1)), "source_code": src["code"],
                               "source_name": src["name"], "source_waste_pct": src["waste_pct"]}
        for a, b in (("皮つき", "皮なし"), ("皮なし", "皮つき")):
            if a in words:
                alt = by_name.get("\u3000".join(b if w == a else w for w in words))
                if alt is not None:
                    f["peel_alt"] = {"code": alt["code"], "label": b, "waste_pct": alt["waste_pct"]}


def extract(version: str, xlsx: str, sheet: str, first_row: int, cols: dict, note_col: int) -> list:
    src = ROOT / "data" / "mext-tables" / version / "raw" / xlsx
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb[sheet]
    foods = []
    notes = {}
    for row in ws.iter_rows(min_row=first_row, values_only=True):
        if row[cols["code"]] is None:
            continue
        f = {}
        for key, idx in cols.items():
            val = row[idx]
            if key in ("group", "code", "index", "name"):
                f[key] = val
            else:
                f[key] = clean(val)
        # 可食部100g当たりで計算しているので、何を切り捨てた量なのか（廃棄部位）も持っておく
        f["waste_part"] = waste_part(row[note_col])
        # めし・かゆは炊く前の米の量が備考にある（発注は米で行うため）
        eq = raw_equiv(f["name"], row[note_col])
        if eq:
            f["raw_equiv"] = eq
        notes[f["code"]] = row[note_col]
        foods.append(f)
    link_derived(foods, notes)
    return foods


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--version", default="2023_増補", choices=sorted(TABLES))
    parser.add_argument("--xlsx", help="raw/ 配下の配布Excelのファイル名（省略時は TABLES の既定値）")
    parser.add_argument("--public-name", help="public/data/ に書き出すファイル名（省略時は TABLES の既定値）")
    args = parser.parse_args()

    conf = TABLES[args.version]
    foods = extract(args.version, args.xlsx or conf["xlsx"], conf["sheet"], conf["first_row"], conf["cols"], conf["note_col"])

    outs = [
        ROOT / "data" / "mext-tables" / args.version / "foods.json",
        ROOT / "public" / "data" / (args.public_name or conf["public_name"]),
    ]
    for out in outs:
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as fp:
            json.dump(foods, fp, ensure_ascii=False, indent=0)
        print(f"wrote {len(foods)} foods -> {out.relative_to(ROOT)}")

    for target in ["食塩", "上白糖", "調合油"]:
        hit = [f for f in foods if f["name"] == target]
        print(target, "->", hit[0] if hit else "NOT FOUND")


if __name__ == "__main__":
    main()
