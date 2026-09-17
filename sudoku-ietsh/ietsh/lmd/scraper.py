#!/usr/bin/env python3
"""
scraper.py
يقرأ كل صفحات iEtsh على LMD ويحدث config.json
ويضيف الألغاز الجديدة تلقائيًا

النجوم:
- levelX.png  = تقييم فعلي من الموقع
- ulevelX.png = تقدير من مؤلف اللغز
"""

import json
import re
import time
import requests
from datetime import datetime
from bs4 import BeautifulSoup


BASE_URL = "https://logic-masters.de/Raetselportal/Benutzer/eingestellt.php?name=iEtsh"

CONFIG_PATH = "sudoku-ietsh/ietsh/lmd/config.json"


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


MONTH_MAP = {
    "Januar": "January",
    "Februar": "February",
    "März": "March",
    "April": "April",
    "Mai": "May",
    "Juni": "June",
    "Juli": "July",
    "August": "August",
    "September": "September",
    "Oktober": "October",
    "November": "November",
    "Dezember": "December",
}


def fetch_page(start=0):
    url = f"{BASE_URL}&start={start}"

    r = requests.get(
        url,
        headers=HEADERS,
        timeout=30
    )

    r.raise_for_status()

    return r.text


def fetch_puzzle(lmd_code):
    url = (
        "https://logic-masters.de/"
        f"Raetselportal/Raetsel/zeigen.php?id={lmd_code}"
    )

    r = requests.get(
        url,
        headers=HEADERS,
        timeout=30
    )

    r.raise_for_status()

    return r.text


def extract_date(text):
    patterns = [
        r"(\d{1,2}\.\s+\w+\s+\d{4},\s+\d{1,2}:\d{2})",
        r"(\d{4}-\d{2}-\d{2})",
        r"(\d{1,2}/\d{1,2}/\d{4})",
    ]

    for pattern in patterns:

        match = re.search(pattern, text)

        if match:
            result = match.group(1)

            for de, en in MONTH_MAP.items():
                result = result.replace(de, en)

            return result

    return ""


def get_sudokupad_link(html):
    soup = BeautifulSoup(
        html,
        "html.parser"
    )

    for a in soup.find_all("a", href=True):

        if a.find("img"):

            href = a["href"]

            if "sudokupad" in href:
                return href

    return ""


def parse_puzzles(html):

    soup = BeautifulSoup(
        html,
        "html.parser"
    )

    puzzles = []

    table = soup.find(
        "table",
        class_="rp_raetselliste"
    )

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

        match = re.search(
            r"id=([A-Z0-9]+)",
            href
        )

        if not match:
            continue

        lmd_code = match.group(1)

        # -----------------------------------------------------
        # Date
        # -----------------------------------------------------

        date = extract_date(str(row))

        if not date:
            date = extract_date(
                cells[1].get_text(
                    " ",
                    strip=True
                )
            )

        if not date:

            for sibling in row.find_all("span"):

                date = extract_date(
                    sibling.get_text(
                        strip=True
                    )
                )

                if date:
                    break

        # -----------------------------------------------------
        # Solves
        # -----------------------------------------------------

        solved_text = cells[2].get_text(
            strip=True
        )

        solved_match = re.match(
            r"(\d+)",
            solved_text
        )

        if solved_match:

            full_num = solved_match.group(1)

            if len(full_num) >= 3:
                solved = int(full_num[:-2])
            else:
                solved = int(full_num)

        else:
            solved = 0

        # -----------------------------------------------------
        # Stars
        # -----------------------------------------------------

        stars = 0
        author_rated = False

        img = cells[3].find("img")

        if img:

            src = img.get(
                "src",
                ""
            )

            # -------------------------------------------------
            # Author estimated difficulty
            #
            # Example:
            # ulevel5.png
            #
            # This is still 5 stars, but the source is
            # different from normal level5.png.
            # -------------------------------------------------

            author_match = re.search(
                r"ulevel(\d)\.png",
                src
            )

            if author_match:

                stars = int(
                    author_match.group(1)
                )

                author_rated = True

            else:

                # ---------------------------------------------
                # Normal evaluated difficulty
                #
                # Example:
                # level1.png
                # level2.png
                # level3.png
                # ---------------------------------------------

                level_match = re.search(
                    r"level(\d)\.png",
                    src
                )

                if level_match:

                    stars = int(
                        level_match.group(1)
                    )

        # -----------------------------------------------------
        # Rating
        # -----------------------------------------------------

        rating = "N/A"

        rating_span = cells[3].find("span")

        if rating_span:

            rating_text = rating_span.get_text(
                strip=True
            )

            rating_text = rating_text.replace(
                "\xa0",
                " "
            )

            if "N/A" not in rating_text:

                rating_match = re.search(
                    r"(\d+)",
                    rating_text
                )

                if rating_match:

                    rating = (
                        rating_match.group(1)
                        + "%"
                    )

        puzzles.append({
            "title": title,
            "lmd": lmd_code,
            "date": date,
            "solved": solved,
            "stars": stars,
            "author_rated": author_rated,
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

    print(
        f"Found {len(all_puzzles)} puzzles on LMD"
    )

    with open(
        CONFIG_PATH,
        "r",
        encoding="utf-8"
    ) as f:

        cfg = json.load(f)

    existing_lmd = {
        item["lmd"]: item
        for item in cfg["items"]
    }

    new_puzzles = []

    for puzzle in all_puzzles:

        if puzzle["lmd"] not in existing_lmd:

            new_puzzles.append(puzzle)

    print(
        f"New puzzles: {len(new_puzzles)}"
    )

    # ---------------------------------------------------------
    # Add new puzzles
    # ---------------------------------------------------------

    for puzzle in new_puzzles:

        try:

            puzzle_html = fetch_puzzle(
                puzzle["lmd"]
            )

            puzz_link = get_sudokupad_link(
                puzzle_html
            )

            if not puzzle["date"]:

                puzzle["date"] = extract_date(
                    puzzle_html
                )

        except Exception as e:

            print(
                f"Error fetching "
                f"{puzzle['lmd']}: {e}"
            )

            puzz_link = ""

        new_id = (
            "ietsh-"
            + re.sub(
                r"[^a-z0-9]",
                "",
                puzzle["title"].lower()
            )
        )

        new_item = {

            "num": 0,

            "id": new_id,

            "title": puzzle["title"],

            "date": puzzle["date"],

            "stars": puzzle["stars"],

            "author_rated": puzzle["author_rated"],

            "puzz": puzz_link,

            "lmd": puzzle["lmd"],

            "solves": puzzle["solved"],

            "rating": puzzle["rating"]
        }

        cfg["items"].append(
            new_item
        )

        print(
            f"Added: {puzzle['title']}"
        )

        time.sleep(0.5)

    # ---------------------------------------------------------
    # Update existing puzzles
    # ---------------------------------------------------------

    for item in cfg["items"]:

        for puzzle in all_puzzles:

            if puzzle["lmd"] != item["lmd"]:
                continue

            item["stars"] = puzzle["stars"]

            item["author_rated"] = (
                puzzle["author_rated"]
            )

            item["solves"] = puzzle["solved"]

            item["rating"] = puzzle["rating"]

            if puzzle["date"]:

                item["date"] = puzzle["date"]

            elif (
                not item.get("date")
                or item["date"] == ""
            ):

                try:

                    puzzle_html = fetch_puzzle(
                        puzzle["lmd"]
                    )

                    item["date"] = extract_date(
                        puzzle_html
                    )

                except:
                    pass

            print(
                f"Updated: {item['title']} -> "
                f"{puzzle['stars']} stars, "
                f"author_rated={puzzle['author_rated']}, "
                f"{puzzle['solved']} solves, "
                f"{puzzle['rating']} | "
                f"date: {item['date']}"
            )

            break

    # ---------------------------------------------------------
    # Sort by date
    # ---------------------------------------------------------

    def parse_date(item):

        try:

            return datetime.strptime(
                item["date"],
                "%d. %B %Y, %H:%M"
            )

        except:

            return datetime.min

    cfg["items"].sort(
        key=parse_date,
        reverse=True
    )

    # ---------------------------------------------------------
    # Numbers
    # ---------------------------------------------------------

    for idx, item in enumerate(
        cfg["items"]
    ):

        item["num"] = (
            len(cfg["items"]) - idx
        )

    # ---------------------------------------------------------
    # Last check
    # ---------------------------------------------------------

    cfg["last_check"] = (
        datetime.utcnow().isoformat()
        + "Z"
    )

    # ---------------------------------------------------------
    # Save
    # ---------------------------------------------------------

    with open(
        CONFIG_PATH,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            cfg,
            f,
            ensure_ascii=False,
            indent=2
        )

    print(
        "config.json updated."
    )


if __name__ == "__main__":
    update_config()
