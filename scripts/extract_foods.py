"""成分表（文科省配布のExcel）から、アプリが読む foods.json を作る。

版ごとに data/mext-tables/<版>/raw/ に配布ファイルを置き、次のように実行する（引数なしは現行の八訂・増補2023）:

    python3 scripts/extract_foods.py --version 2023_増補

出力:
  - data/mext-tables/<版>/foods.json   … 版ごとの保管用
  - public/data/<public-name>          … アプリが実際に配信・読み込むファイル（src/data/foodTable.ts の file と揃える）

新しい版の候補を取り込むだけなら（配信ファイルは書かない）:

    python3 scripts/extract_foods.py --xlsx-path 新しい.xlsx --out 候補/foods.json

列は位置ではなく、Excelの「成分識別子」行（ENERC_KCAL・PROT- など国際的な識別子）と
見出し（食品番号・食品名・備考など）で探す。改訂で列の並びが変わっても追従できる。
手順は docs/food-table-upgrade.md を参照。
"""
import argparse
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent

# 版 -> 配布ファイル名と配信ファイル名
TABLES = {
    "2023_増補": {
        "xlsx": "20260327-mxt_kagsei-mext-000029402_02.xlsx",
        "public_name": "foods.2023-zouho.json",
    },
}

# アプリの項目 -> Excelの成分識別子（INFOODS タグ名）
IDENTIFIERS = {
    "waste_pct": "REFUSE",
    "kcal": "ENERC_KCAL",
    "protein_g": "PROT-",
    "fat_g": "FAT-",
    "carb_g": "CHOCDF-",
    "fiber_g": "FIB-",
    "ca_mg": "CA",
    "fe_mg": "FE",
    "va_ugRAE": "VITA_RAE",
    "vd_ug": "VITD",
    "vb1_mg": "THIA",
    "vb2_mg": "RIBF",
    "vc_mg": "VITC",
    "salt_g": "NACL_EQ",
}
# アプリの項目 -> 見出しの文字（空白を除いて比べる）
HEADINGS = {"group": "食品群", "code": "食品番号", "index": "索引番号", "name": "食品名", "note": "備考"}
# JSON の項目の並び（既存の JSON と同じ順に保つ）
KEY_ORDER = ["group", "code", "index", "name", "waste_pct", "kcal", "protein_g", "fat_g", "carb_g", "fiber_g",
             "ca_mg", "fe_mg", "va_ugRAE", "vd_ug", "vb1_mg", "vb2_mg", "vc_mg", "salt_g"]


class LayoutError(Exception):
    pass


def _plain(v) -> str:
    return re.sub(r"\s+", "", str(v)) if v is not None else ""


def detect_layout(ws, scan_rows: int = 40) -> dict:
    """見出し行と成分識別子行から列の位置を割り出す。見つからなければ LayoutError。"""
    rows = list(ws.iter_rows(min_row=1, max_row=scan_rows, values_only=True))
    id_row = None
    for i, r in enumerate(rows):
        if any(_plain(v) == "ENERC_KCAL" for v in r):
            id_row = i
            break
    if id_row is None:
        raise LayoutError("成分識別子の行（ENERC_KCAL を含む行）が見つかりません")
    ids = {_plain(v): j for j, v in enumerate(rows[id_row]) if _plain(v)}
    cols = {}
    for key, ident in IDENTIFIERS.items():
        if ident not in ids:
            raise LayoutError(f"成分識別子 {ident}（{key}）の列が見つかりません")
        cols[key] = ids[ident]
    for key, heading in HEADINGS.items():
        found = [j for r in rows[:id_row] for j, v in enumerate(r) if _plain(v) == heading]
        if not found:
            raise LayoutError(f"見出し「{heading}」の列が見つかりません")
        cols[key] = found[0]
    note_col = cols.pop("note")
    return {"cols": cols, "note_col": note_col, "first_row": id_row + 2}  # iter_rows は1始まり


def find_sheet(wb):
    """成分表の本表のシートを返す（「表全体」を優先、無ければ列を割り出せる最初のシート）。"""
    names = ["表全体"] + [n for n in wb.sheetnames if n != "表全体"]
    errors = []
    for n in names:
        if n not in wb.sheetnames:
            continue
        try:
            return wb[n], detect_layout(wb[n])
        except LayoutError as e:
            errors.append(f"{n}: {e}")
    raise LayoutError("成分表の本表が見つかりません（" + " / ".join(errors[:3]) + "）")


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


def extract(src: Path) -> list:
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws, layout = find_sheet(wb)
    cols, note_col = layout["cols"], layout["note_col"]
    foods = []
    notes = {}
    for row in ws.iter_rows(min_row=layout["first_row"], values_only=True):
        if len(row) <= cols["code"] or row[cols["code"]] is None:
            continue
        f = {}
        for key in KEY_ORDER:
            val = row[cols[key]]
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


def write_json(foods: list, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fp:
        json.dump(foods, fp, ensure_ascii=False, indent=0)
    print(f"wrote {len(foods)} foods -> {out}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--version", default="2023_増補", choices=sorted(TABLES))
    parser.add_argument("--xlsx-path", help="任意の配布Excel（新しい版の候補など）。指定時は --out に書き出し、配信ファイルは書かない")
    parser.add_argument("--out", help="--xlsx-path の出力先（foods.json）")
    args = parser.parse_args()

    if args.xlsx_path:
        if not args.out:
            parser.error("--xlsx-path には --out が必要です")
        write_json(extract(Path(args.xlsx_path)), Path(args.out))
        return

    conf = TABLES[args.version]
    foods = extract(ROOT / "data" / "mext-tables" / args.version / "raw" / conf["xlsx"])
    for out in (ROOT / "data" / "mext-tables" / args.version / "foods.json", ROOT / "public" / "data" / conf["public_name"]):
        write_json(foods, out)


if __name__ == "__main__":
    main()
