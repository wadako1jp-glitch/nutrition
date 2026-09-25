"""文部科学省の成分表ページを見て、新しい版（九訂など）や配布ファイルの更新を検知する。
GitHub Actions（.github/workflows/watch-food-table.yml）から週1回動かす。

    python3 scripts/watch_mext.py --out 作業ディレクトリ [--candidate]

- 監視するページの「タイトル」と「配布ファイル（.xlsx/.xls/.zip/.pdf）・成分表関連のリンク」を集めて
  data/mext-tables/watch-baseline.json（前回マージした時点の状態）と比べる
- 変化があれば 作業ディレクトリ に snapshot.json（新しい基準）と changes.md（何が変わったか）を書く
- --candidate を付けると、新しく出た Excel を落として成分表として読めるか試し、読めたものを
  新しい版の候補として candidate/（raw/ に配布ファイル、foods.json、report.md）に書く
- 終了コード: 0 = 変化なし / 10 = 変化あり / それ以外 = 取得失敗など（Actions の実行が失敗扱いになり、持ち主に通知が届く）
"""
import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import diff_food_tables  # noqa: E402
import extract_foods  # noqa: E402

BASELINE = ROOT / "data" / "mext-tables" / "watch-baseline.json"


def current_json() -> Path:
    """アプリが今使っている版の foods.json（src/data/foodTable.ts の CURRENT_FOOD_TABLE から読む）。"""
    src = (ROOT / "src" / "data" / "foodTable.ts").read_text(encoding="utf-8")
    table_id = re.search(r'CURRENT_FOOD_TABLE[^=]*=\s*FOOD_TABLES\["([^"]+)"\]', src).group(1)
    block = src[src.index(f'"{table_id}": {{'):]
    return ROOT / "public" / re.search(r'file:\s*"([^"]+)"', block).group(1)

# 監視するページ（環境変数 WATCH_URLS をカンマ区切りで渡すと差し替えられる。テスト用）
DEFAULT_URLS = [
    "https://www.mext.go.jp/a_menu/syokuhinseibun/index.htm",  # 成分表の入口（新しい版のページへのリンク）
    "https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html",  # 今の版（八訂 増補2023）の配布ページ
    "https://fooddb.mext.go.jp/",  # 食品成分データベース（表示している版の名前）
]
DATA_EXT = (".xlsx", ".xls", ".zip", ".pdf")
EXCEL_EXT = (".xlsx",)  # openpyxl で読めるもの
MAX_DOWNLOADS = 10


class LinkParser(HTMLParser):
    def __init__(self, base: str):
        super().__init__()
        self.base = base
        self.title = ""
        self.links = []
        self._in_title = False
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        elif tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "a" and self._href:
            text = re.sub(r"\s+", " ", "".join(self._text)).strip()
            self.links.append({"href": urljoin(self.base, self._href), "text": text})
            self._href = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._href is not None:
            self._text.append(data)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "nutrition-app-food-table-watch (GitHub Actions)"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read()


def decode(raw: bytes) -> str:
    m = re.search(rb'charset=["\']?([A-Za-z0-9_\-]+)', raw[:4096])
    for enc in ([m.group(1).decode()] if m else []) + ["utf-8", "shift_jis", "cp932"]:
        try:
            return raw.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", errors="replace")


def interesting(link: dict) -> bool:
    path = urlparse(link["href"]).path.lower()
    return path.endswith(DATA_EXT) or "成分" in link["text"]


def page_snapshot(url: str) -> dict:
    p = LinkParser(url)
    p.feed(decode(fetch(url)))
    links = sorted({(l["href"], l["text"]) for l in p.links if interesting(l)})
    return {"title": re.sub(r"\s+", " ", p.title).strip(), "links": [{"href": h, "text": t} for h, t in links]}


def diff_snapshots(old: dict, new: dict) -> tuple[str, list]:
    """変化の説明（Markdown）と、新しく現れた配布ファイルのURLを返す。"""
    lines, new_files = [], []
    for url, page in new.items():
        before = old.get(url)
        if before is None:
            lines.append(f"- 監視を始めたページ: {url}（{page['title']}）")
            continue
        if before["title"] != page["title"]:
            lines.append(f"- タイトルが変わった: {url}\n  - 前: {before['title']}\n  - 後: **{page['title']}**")
        old_links = {l["href"]: l["text"] for l in before["links"]}
        new_links = {l["href"]: l["text"] for l in page["links"]}
        for href in sorted(set(new_links) - set(old_links)):
            lines.append(f"- 新しいリンク（{url}）: [{new_links[href] or href}]({href})")
            if urlparse(href).path.lower().endswith(DATA_EXT):
                new_files.append(href)
        for href in sorted(set(old_links) - set(new_links)):
            lines.append(f"- なくなったリンク（{url}）: {old_links[href] or href} — {href}")
    for url in sorted(set(old) - set(new)):
        lines.append(f"- 監視から外したページ: {url}")
    return "\n".join(lines), new_files


def try_candidate(urls: list, out: Path) -> str:
    """新しい Excel のうち成分表の本表として読めるものを取り込み、差分レポートを作る。説明（Markdown）を返す。"""
    notes = []
    best = None
    for href in [u for u in urls if urlparse(u).path.lower().endswith(EXCEL_EXT)][:MAX_DOWNLOADS]:
        name = Path(urlparse(href).path).name
        dest = out / "candidate" / "raw" / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            dest.write_bytes(fetch(href))
            foods = extract_foods.extract(dest)
        except Exception as e:  # 本表でない Excel（アミノ酸表など）は読めないのが普通
            notes.append(f"- {name}: 成分表の本表としては読めませんでした（{type(e).__name__}: {e}）")
            dest.unlink(missing_ok=True)
            continue
        notes.append(f"- {name}: {len(foods)} 食品を読み取りました")
        if best is None or len(foods) > len(best[1]):
            if best is not None:
                best[2].unlink(missing_ok=True)
            best = (name, foods, dest)
        else:
            dest.unlink(missing_ok=True)
    if best is None or len(best[1]) < 1000:
        return "\n".join(notes + ["", "成分表の本表として使える Excel は見つかりませんでした（ページの変化だけの可能性）。"])
    name, foods, _ = best
    extract_foods.write_json(foods, out / "candidate" / "foods.json")
    current = json.loads(current_json().read_text(encoding="utf-8"))
    report = diff_food_tables.report(current, foods)
    (out / "candidate" / "report.md").write_text(report, encoding="utf-8")
    return "\n".join(notes + ["", f"候補として **{name}** を取り込みました（{len(foods)} 食品）。", "", report])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="作業ディレクトリ")
    ap.add_argument("--candidate", action="store_true", help="新しい Excel を取り込んで候補を作る")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    urls = [u.strip() for u in os.environ.get("WATCH_URLS", "").split(",") if u.strip()] or DEFAULT_URLS
    snapshot = {u: page_snapshot(u) for u in urls}  # 1つでも取れなければ例外で終了（誤検知しないため）
    baseline = json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.exists() else {}
    if snapshot == baseline:
        print("変化なし")
        return 0

    text, new_files = diff_snapshots(baseline, snapshot)
    body = ["## 成分表のページに変化がありました", "", text or "- （リンクの並びなどの細かな変化）", ""]
    if not baseline:
        body += ["監視の基準がまだ無いため、今の状態を基準として登録します（新しい版の取り込みはしません）。", ""]
    elif args.candidate and new_files:
        body += ["## 新しい配布ファイルの取り込み", "", try_candidate(new_files, out), ""]
    (out / "snapshot.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (out / "changes.md").write_text("\n".join(body), encoding="utf-8")
    digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()[:12]
    (out / "digest.txt").write_text(digest, encoding="utf-8")
    print(f"変化あり（{digest}）")
    return 10


if __name__ == "__main__":
    sys.exit(main())
