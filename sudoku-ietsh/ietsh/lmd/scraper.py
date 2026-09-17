#!/usr/bin/env python3
"""
scraper.py
يقرأ كل صفحات iEtsh على LMD ويحدث config.json
"""

import json
import re
import requests

BASE_URL = "https://logic-masters.de/Raetselportal/Benutzer/eingestellt.php?name=iEtsh"
CONFIG_PATH = "sudoku-ietsh/ietsh/lmd/config.json"

def fetch_page(start=0):
    url = f"{BASE_URL}&start={start}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.text

def parse_puzzles(html):
    puzzles = []
    
    # كل لغز بيبدأ بـ <tr> وفيه <a href="...id=XXXXX">Title</a>
    # وبعدين <td align="center">SOLVES</td>
    # وبعدين <td align="center"><img src="...levelN.png"...><br><span...>RATING%</span>
    
    # نقسم الصفحة على <tr>
    rows = re.split(r'<tr[^>]*>', html)
    
    for row in rows:
        # اسم اللغز + كود LMD
        link_match = re.search(
            r'<a href="/Raetselportal/Raetsel/zeigen\.php\?id=([A-Z0-9]+)"[^>]*>([^<]+)</a>',
            row
        )
        if not link_match:
            continue
        lmd_code = link_match.group(1)
        title = link_match.group(2).strip()
        
        # عدد الحلول: <td align="center">114</td>
        solved_match = re.search(
            r'<td align="center">(\d+)</td>',
            row
        )
        solved = int(solved_match.group(1)) if solved_match else 0
        
        # النجوم: levelN.png
        stars = 0
        stars_match = re.search(r'level(\d)\.png', row)
        if stars_match:
            stars = int(stars_match.group(1))
        elif 'ulevel5' in row:
            stars = 5
        
        # النسبة: <span title="...">95&nbsp;%</span>
        rating = ""
        rating_match = re.search(r'<span title="[^"]*">(\d+)&nbsp;%</span>', row)
        if rating_match:
            rating = rating_match.group(1) + "%"
        
        puzzles.append({
            "title": title,
            "lmd": lmd_code,
            "solved": solved,
            "stars": stars,
            "rating": rating
        })
    
    return puzzles

def update_config():
    all_puzzles = []
    start = 0
    while True:
        html = fetch_page(start)
        puzzles = parse_puzzles(html)
        if not puzzles:
            break
        all_puzzles.extend(puzzles)
        if len(puzzles) < 20:
            break
        start += 20
    
    print(f"Found {len(all_puzzles)} puzzles")
    for p in all_puzzles[:5]:
        print(f"  {p['lmd']} | {p['title'][:40]} | {p['solved']} solves | {p['stars']} stars | {p['rating']}")
    
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    
    updated = 0
    for item in cfg["items"]:
        for p in all_puzzles:
            if p["lmd"] == item["lmd"]:
                item["stars"] = p["stars"]
                item["solves"] = p["solved"]
                item["rating"] = p["rating"]
                print(f"Updated: {item['title']} -> {p['stars']} stars, {p['solved']} solves, {p['rating']}")
                updated += 1
                break
    
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    
    print(f"config.json updated. {updated} puzzles updated.")

if __name__ == "__main__":
    update_config()
