import json, re
import openpyxl

SRC = "data/mext-tables/2023_増補/raw/20260327-mxt_kagsei-mext-000029402_02.xlsx"
OUT = "data/mext-tables/2023_増補/foods.json"

COLS = {
    "group": 0, "code": 1, "index": 2, "name": 3, "waste_pct": 4,
    "kcal": 6, "protein_g": 9, "fat_g": 12, "carb_g": 20, "fiber_g": 18,
    "ca_mg": 25, "fe_mg": 28, "va_ugRAE": 42, "vd_ug": 43,
    "vb1_mg": 49, "vb2_mg": 50, "vc_mg": 58, "salt_g": 60,
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

def main():
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb["表全体"]
    foods = []
    for row in ws.iter_rows(min_row=13, values_only=True):
        if row[COLS["code"]] is None:
            continue
        f = {}
        for key, idx in COLS.items():
            val = row[idx]
            if key in ("group", "code", "index", "name"):
                f[key] = val
            else:
                f[key] = clean(val)
        foods.append(f)
    with open(OUT, "w", encoding="utf-8") as fp:
        json.dump(foods, fp, ensure_ascii=False, indent=0)
    print(f"wrote {len(foods)} foods -> {OUT}")

    by_name = {f["name"]: f for f in foods}
    for target in ["食塩", "上白糖", "調合油"]:
        hit = [f for f in foods if f["name"] == target]
        print(target, "->", hit[0] if hit else "NOT FOUND")

if __name__ == "__main__":
    main()
