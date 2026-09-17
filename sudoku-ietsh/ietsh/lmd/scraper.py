#!/usr/bin/env python3
"""
scraper.py
يقرأ كل صفحات iEtsh على LMD ويحدث config.json
"""

import json
import re
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://logic-masters.de/Raetselportal/Benutzer/eingestellt.php?name=iEtsh"
CONFIG_PATH = "sudoku-ietsh/ietsh/lmd/config.json"

def fetch_page(start=0):
    url = f"{BASE_URL}&start={start}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.text

def parse_puzzles(html):
    soup = BeautifulSoup(html, "html.parser")
    puzzles = []
    table = soup.find("table", class_="rp_raetselliste")
    if not table:
        return puzzles
    
    rows = table.find_all("tr")
    for row in rows[1:]:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        
        link = cells[1].find("a")
        if not link:
            continue
        title = link.get_text(strip=True)
        href = link.get("href", "")
        m = re.search(r"id=([A-Z0-9]+)", href)
        lmd_code = m.group(1) if m else ""
        
        solved = cells[2].get_text(strip=True)
        
        stars = 0
        img = cells[3].find("img")
        if img:
            src = img.get("src", "")
            m = re.search(r"level(\d)\.png", src)
            if m:
                stars = int(m.group(1))
            elif "ulevel5" in src:
                stars = 5
        
        rating_span = cells[3].find("span")
        rating = rating_span.get_text(strip=True) if rating_span else ""
        
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
    
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    
    updated = 0
    for item in cfg["items"]:
        for p in all_puzzles:
            if p["lmd"] == item["lmd"]:
                item["stars"] = p["stars"]
                item["solves"] = int(p["solved"])
                item["rating"] = p["rating"]
                print(f"Updated: {item['title']} -> {p['stars']} stars, {p['solved']} solves, {p['rating']}")
                updated += 1
                break
    
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    
    print(f"config.json updated. {updated} puzzles updated.")

if __name__ == "__main__":
    update_config()
