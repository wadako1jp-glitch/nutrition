# -*- coding: utf-8 -*-
import json, re
from synonyms import SYNONYMS

foods = json.load(open("data/mext-tables/2023_増補/foods.json", encoding="utf-8"))
def norm(s):
    return s.replace("　", "").replace(" ", "")
food_names = [(f["code"], f["name"], norm(f["name"])) for f in foods]

terms_fixed = [
    "こいくちしょうゆ", "にわとり・もも・皮つき・生", "うし・ひき肉・生", "ぶた・ひき肉・生",
    "うすくちしょうゆ", "にんにく・おろし", "クリーム・乳脂肪",
]

def match(term):
    tokens = [norm(t) for t in re.split("[・\\s]", term) if t]
    best = None
    for code, name, nname in food_names:
        if all(t in nname for t in tokens):
            score = len(nname)
            if best is None or score < best[2]:
                best = (code, name)
    return best

for t in terms_fixed:
    print(t, "->", match(t))
