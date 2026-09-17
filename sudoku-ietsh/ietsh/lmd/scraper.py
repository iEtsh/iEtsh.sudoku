#!/usr/bin/env python3
"""
scraper.py
يقرأ كل صفحات iEtsh على LMD ويحدث config.json
ويضيف الألغاز الجديدة تلقائيًا
"""

import json
import re
import time
import requests
from datetime import datetime
from bs4 import BeautifulSoup

BASE_URL = "https://logic-masters.de/Raetselportal/Benutzer/eingestellt.php?name=iEtsh"
CONFIG_PATH = "sudoku-ietsh/ietsh/lmd/config.json"

def fetch_page(start=0):
    url = f"{BASE_URL}&start={start}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.text

def fetch_puzzle(lmd_code):
    url = f"https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id={lmd_code}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.text

def get_sudokupad_link(html):
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        if a.find("img"):
            href = a["href"]
            if "sudokupad" in href:
                return href
    return ""

def parse_puzzles(html):
    soup = BeautifulSoup(html, "html.parser")
    puzzles = []
    table = soup.find("table", class_="rp_raetselliste")
    if not table:
        return puzzles
    
    rows = table.find_all("tr")
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        
        link = cells[1].find("a")
        if not link:
            continue
        title = link.get_text(strip=True)
        href = link.get("href", "")
        m = re.search(r"id=([A-Z0-9]+)", href)
        if not m:
            continue
        lmd_code = m.group(1)
        
        # التاريخ من صفحة القايمة — باستخدام regex على HTML الخام
        date = ""
        row_html = str(row)
        date_match = re.search(r'on (\d{1,2}\. \w+ \d{4}, \d{2}:\d{2})\)', row_html)
        if date_match:
            date = date_match.group(1)
        
        # عدد الحلول
        solved_text = cells[2].get_text(strip=True)
        solved_match = re.match(r"(\d+)", solved_text.strip())
        if solved_match:
            full_num = solved_match.group(1)
            if len(full_num) >= 3:
                solved = int(full_num[:-2])
            else:
                solved = int(full_num)
        else:
            solved = 0
        
        # النجوم — لو مفيش تقييم، N/A
        stars = "N/A"
        img = cells[3].find("img")
        if img:
            src = img.get("src", "")
            if "ulevel5" in src:
                stars = "N/A"
            else:
                m = re.search(r"level(\d)\.png", src)
                if m:
                    stars = int(m.group(1))
        
        # التقييم
        rating = "N/A"
        rating_span = cells[3].find("span")
        if rating_span:
            rating_text = rating_span.get_text(strip=True)
            rating_text = rating_text.replace('\xa0', ' ')
            if "N/A" not in rating_text:
                rating_match = re.search(r"(\d+)", rating_text)
                if rating_match:
                    rating = rating_match.group(1) + "%"
        
        puzzles.append({
            "title": title,
            "lmd": lmd_code,
            "date": date,
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
    
    print(f"Found {len(all_puzzles)} puzzles on LMD")
    
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    
    existing_lmd = {item["lmd"]: item for item in cfg["items"]}
    
    new_puzzles = []
    for p in all_puzzles:
        if p["lmd"] not in existing_lmd:
            new_puzzles.append(p)
    
    print(f"New puzzles: {len(new_puzzles)}")
    
    for p in new_puzzles:
        try:
            puzzle_html = fetch_puzzle(p["lmd"])
            puzz_link = get_sudokupad_link(puzzle_html)
        except Exception as e:
            print(f"Error fetching {p['lmd']}: {e}")
            puzz_link = ""
        
        new_id = "ietsh-" + re.sub(r'[^a-z0-9]', '', p["title"].lower())
        
        new_item = {
            "num": 0,
            "id": new_id,
            "title": p["title"],
            "date": p["date"],
            "stars": p["stars"],
            "puzz": puzz_link,
            "lmd": p["lmd"],
            "solves": p["solved"],
            "rating": p["rating"]
        }
        cfg["items"].append(new_item)
        print(f"Added: {p['title']}")
        
        time.sleep(0.5)
    
    for item in cfg["items"]:
        for p in all_puzzles:
            if p["lmd"] == item["lmd"]:
                item["stars"] = p["stars"]
                item["solves"] = p["solved"]
                item["rating"] = p["rating"]
                if p["date"]:
                    item["date"] = p["date"]
                print(f"Updated: {item['title']} -> {p['stars']} stars, {p['solved']} solves, {p['rating']} | date: {p['date']}")
                break
    
    def parse_date(item):
        try:
            return datetime.strptime(item["date"], "%d. %B %Y, %H:%M")
        except:
            return datetime.min
    
    cfg["items"].sort(key=parse_date, reverse=True)
    
    for idx, item in enumerate(cfg["items"]):
        item["num"] = len(cfg["items"]) - idx
    
    cfg["last_check"] = datetime.utcnow().isoformat() + "Z"
    
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    
    print(f"config.json updated.")

if __name__ == "__main__":
    update_config()
