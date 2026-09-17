#!/usr/bin/env python3
"""
scraper.py
يقرأ كل صفحة لغز (نسخة print) على LMD ويحدث config.json
"""

import json
import re
import time
import requests

CONFIG_PATH = "sudoku-ietsh/ietsh/lmd/config.json"

def fetch_puzzle_print(lmd_code):
    url = f"https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id={lmd_code}&print=true"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.text

def parse_puzzle(html):
    # نشيل الـ HTML tags ونحول النص لنص عادي
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text)
    
    stars = 0
    m = re.search(r'level(\d)\.png', html)
    if m:
        stars = int(m.group(1))
    elif 'ulevel5' in html:
        stars = 5
    
    rating = ""
    m = re.search(r'(\d+)\s*%', text)
    if m:
        rating = m.group(1) + "%"
    
    solved = 0
    m = re.search(r'(\d+)\s*times', text)
    if m:
        solved = int(m.group(1))
    
    return {
        "stars": stars,
        "rating": rating,
        "solved": solved
    }

def update_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    
    updated = 0
    for item in cfg["items"]:
        lmd_code = item["lmd"]
        try:
            html = fetch_puzzle_print(lmd_code)
            data = parse_puzzle(html)
            
            item["stars"] = data["stars"]
            item["solves"] = data["solved"]
            item["rating"] = data["rating"]
            
            print(f"Updated: {item['title']} -> {data['stars']} stars, {data['solved']} solves, {data['rating']}")
            updated += 1
        except Exception as e:
            print(f"Error with {lmd_code}: {e}")
        
        time.sleep(0.5)
    
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    
    print(f"config.json updated. {updated} puzzles updated.")

if __name__ == "__main__":
    update_config()
