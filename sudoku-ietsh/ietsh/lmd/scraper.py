#!/usr/bin/env python3
"""
scraper.py

يقرأ كل صفحات iEtsh على LMD ويحدث config.json
ويضيف الألغاز الجديدة تلقائيًا.

كما يقوم تلقائيًا بتحميل صورة كل Puzzle إلى:
sudoku-ietsh/ietsh/lmd/images/

ويضيف مسار الصورة داخل config.json.
 
النجوم:
- levelX.png  = تقييم عادي → author_rated = false
- ulevelX.png = تقييم المؤلف → author_rated = true
"""

import json
import os
import re
import time
import requests

from playwright.sync_api import sync_playwright

from datetime import datetime
from urllib.parse import urljoin

from bs4 import BeautifulSoup


BASE_URL = (
    "https://logic-masters.de/"
    "Raetselportal/Benutzer/eingestellt.php?name=iEtsh"
)

PUZZLE_BASE_URL = (
    "https://logic-masters.de/"
    "Raetselportal/Raetsel/zeigen.php?id="
)

CONFIG_PATH = (
    "sudoku-ietsh/ietsh/lmd/config.json"
)

UPDATE_LOG_PATH = (
    "sudoku-ietsh/ietsh/lmd/update-log.json"
)

IMAGE_DIR = (
    "sudoku-ietsh/ietsh/lmd/images"
)

HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36",

    "Accept-Language":
        "en-US,en;q=0.9",
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
    "Dezember": "December"
}


# ---------------------------------------------------------
# HTTP
# ---------------------------------------------------------

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
        PUZZLE_BASE_URL
        + lmd_code
    )

    r = requests.get(
        url,
        headers=HEADERS,
        timeout=30
    )

    r.raise_for_status()

    return r.text


# ---------------------------------------------------------
# Date
# ---------------------------------------------------------

def extract_date(text):

    patterns = [
        r'(\d{1,2}\.\s+\w+\s+\d{4},\s+\d{1,2}:\d{2})',
        r'(\d{4}-\d{2}-\d{2})',
        r'(\d{1,2}/\d{1,2}/\d{4})',
    ]

    for p in patterns:

        m = re.search(
            p,
            text
        )

        if m:

            result = m.group(1)

            for de, en in MONTH_MAP.items():
                result = result.replace(
                    de,
                    en
                )

            return result

    return ""


# ---------------------------------------------------------
# SudokuPad
# ---------------------------------------------------------

def get_sudokupad_solve_counter(
    page,
    puzzle_url
):
    if not puzzle_url:
        return None

    try:
        print(
            f"Reading SudokuPad solve counter: "
            f"{puzzle_url}"
        )

        page.goto(
            puzzle_url,
            wait_until="domcontentloaded",
            timeout=60000
        )

        time.sleep(3)

        counter = page.locator(
            "#solvedcounter_val"
        )

        value = counter.text_content(
            timeout=10000
        )

        if value:
            match = re.search(
                r"\d+",
                value
            )

            if match:
                solves = int(
                    match.group(0)
                )

                print(
                    f"SudokuPad solve counter: "
                    f"{solves}"
                )

                return solves

    except Exception as e:
        print(
            f"Error getting SudokuPad solve counter "
            f"from {puzzle_url}: {e}"
        )

    return None


def update_sudokupad_solves(
    item,
    page
):
    puzzle_url = item.get(
        "puzz",
        ""
    )

    if not puzzle_url:
        return

    solves = get_sudokupad_solve_counter(
        page,
        puzzle_url
    )

    if solves is not None:
        item["sudokupad_solves"] = solves

def get_sudokupad_link(html):

    soup = BeautifulSoup(
        html,
        "html.parser"
    )

    # The LMD puzzle page has a dedicated
    # "Solve Puzzle" link. Always prefer that
    # exact link so we never pick a SudokuPad
    # link belonging to another puzzle or a
    # hidden image/link elsewhere on the page.
    for a in soup.find_all(
        "a",
        href=True
    ):

        href = a.get(
            "href",
            ""
        ).strip()

        text = a.get_text(
            " ",
            strip=True
        ).lower()

        if (
            "sudokupad" in href.lower()
            and "solve puzzle" in text
        ):
            return href

    # Fallback: accept a direct SudokuPad link
    # only when it is not attached to an image.
    # This avoids the old image-based selection
    # that could associate the wrong puzzle.
    for a in soup.find_all(
        "a",
        href=True
    ):

        href = a.get(
            "href",
            ""
        ).strip()

        if (
            "sudokupad" in href.lower()
            and not a.find("img")
        ):
            return href

    return ""


# ---------------------------------------------------------
# Puzzle image
# ---------------------------------------------------------

def get_puzzle_image_url(html):

    soup = BeautifulSoup(
        html,
        "html.parser"
    )

    candidates = []

    for img in soup.find_all(
        "img",
        src=True
    ):

        src = img.get("src", "").strip()

        if not src:
            continue

        absolute_url = urljoin(
            "https://logic-masters.de/",
            src
        )

        lower_url = absolute_url.lower()

        # LMD puzzle images are normally served
        # through /Dateien/bild.php
        if "/dateien/bild.php" in lower_url:
            return absolute_url

        # Keep other /Dateien/ images as fallback.
        if "/dateien/" in lower_url:
            candidates.append(
                absolute_url
            )

    if candidates:
        return candidates[0]

    return ""


# ---------------------------------------------------------
# Image extension
# ---------------------------------------------------------

def get_extension_from_content_type(content_type):

    content_type = (
        content_type or ""
    ).lower()

    if "png" in content_type:
        return ".png"

    if "jpeg" in content_type:
        return ".jpg"

    if "jpg" in content_type:
        return ".jpg"

    if "webp" in content_type:
        return ".webp"

    if "gif" in content_type:
        return ".gif"

    return ".png"


# ---------------------------------------------------------
# Download image
# ---------------------------------------------------------

def download_image(
    image_url,
    lmd_code
):

    if not image_url:
        return ""

    os.makedirs(
        IMAGE_DIR,
        exist_ok=True
    )

    try:

        response = requests.get(
            image_url,
            headers=HEADERS,
            timeout=60
        )

        response.raise_for_status()

        content_type = response.headers.get(
            "Content-Type",
            ""
        )

        extension = (
            get_extension_from_content_type(
                content_type
            )
        )

        filename = (
            f"{lmd_code}{extension}"
        )

        filepath = os.path.join(
            IMAGE_DIR,
            filename
        )

        with open(
            filepath,
            "wb"
        ) as f:

            f.write(
                response.content
            )

        relative_path = (
            f"images/{filename}"
        )

        print(
            f"Downloaded image: "
            f"{lmd_code} -> "
            f"{relative_path}"
        )

        return relative_path

    except Exception as e:

        print(
            f"Error downloading image "
            f"for {lmd_code}: {e}"
        )

        return ""


# ---------------------------------------------------------
# Ensure puzzle image exists
# ---------------------------------------------------------

def ensure_puzzle_image(item):

    existing_image = item.get(
        "image",
        ""
    )

    # If config already contains an image
    # and the file still exists, nothing to do.
    if existing_image:

        filepath = os.path.join(
            "sudoku-ietsh/ietsh/lmd",
            existing_image
        )

        if os.path.isfile(filepath):

            return existing_image

    lmd_code = item.get(
        "lmd",
        ""
    )

    if not lmd_code:
        return ""

    try:

        puzzle_html = fetch_puzzle(
            lmd_code
        )

        image_url = get_puzzle_image_url(
            puzzle_html
        )

        if not image_url:

            print(
                f"No puzzle image found "
                f"for {lmd_code}"
            )

            return ""

        image_path = download_image(
            image_url,
            lmd_code
        )

        if image_path:
            return image_path

    except Exception as e:

        print(
            f"Error getting image "
            f"for {lmd_code}: {e}"
        )

    return ""


# ---------------------------------------------------------
# Parse puzzle list
# ---------------------------------------------------------

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

    rows = table.find_all(
        "tr"
    )

    for row in rows:

        cells = row.find_all(
            "td"
        )

        if len(cells) < 4:
            continue

        # -------------------------------------------------
        # Puzzle title + LMD code
        # -------------------------------------------------

        link = cells[1].find(
            "a"
        )

        if not link:
            continue

        title = link.get_text(
            strip=True
        )

        href = link.get(
            "href",
            ""
        )

        m = re.search(
            r"id=([A-Z0-9]+)",
            href
        )

        if not m:
            continue

        lmd_code = m.group(1)

        # -------------------------------------------------
        # Date
        # -------------------------------------------------

        date = extract_date(
            str(row)
        )

        if not date:

            date = extract_date(
                cells[1].get_text(
                    " ",
                    strip=True
                )
            )

        if not date:

            for sibling in row.find_all(
                "span"
            ):

                date = extract_date(
                    sibling.get_text(
                        strip=True
                    )
                )

                if date:
                    break

        # -------------------------------------------------
        # Solves
        # -------------------------------------------------

        solved_text = cells[2].get_text(
            strip=True
        )

        solved_match = re.match(
            r"(\d+)",
            solved_text.strip()
        )

        if solved_match:

            full_num = solved_match.group(
                1
            )

            if len(full_num) >= 3:
                solved = int(
                    full_num[:-2]
                )
            else:
                solved = int(
                    full_num
                )

        else:

            solved = 0

        # -------------------------------------------------
        # Difficulty / Stars
        # -------------------------------------------------

        stars = "N/A"
        author_rated = False

        img = cells[3].find(
            "img"
        )

        if img:

            src = img.get(
                "src",
                ""
            ).lower()

            # Author estimated difficulty
            m = re.search(
                r'ulevel(\d)\.png',
                src
            )

            if m:

                stars = int(
                    m.group(1)
                )

                author_rated = True

            else:

                # Normal evaluated difficulty
                m = re.search(
                    r'level(\d)\.png',
                    src
                )

                if m:

                    stars = int(
                        m.group(1)
                    )

                    author_rated = False

        # -------------------------------------------------
        # Rating
        # -------------------------------------------------

        rating = "N/A"

        rating_span = cells[3].find(
            "span"
        )

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


# ---------------------------------------------------------
# Persistent update log
# ---------------------------------------------------------

UPDATE_FIELDS = {
    "title": "Title Changed",
    "date": "Date Changed",
    "stars": "Difficulty Changed",
    "author_rated": "Author Rating Changed",
    "puzz": "SudokuPad Link Changed",
    "lmd": "LMD Link Changed",
    "solves": "LMD Solvers Changed",
    "sudokupad_solves": "SudokuPad Solvers Changed",
    "rating": "Rating Changed",
    "qs": "Puzzle Settings Changed",
    "image": "Puzzle Image Changed"
}


def load_update_log():
    if not os.path.isfile(UPDATE_LOG_PATH):
        return []

    try:
        with open(
            UPDATE_LOG_PATH,
            "r",
            encoding="utf-8"
        ) as f:
            data = json.load(f)

        return data if isinstance(data, list) else []

    except Exception:
        return []


def save_update_log(log):
    with open(
        UPDATE_LOG_PATH,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            log,
            f,
            ensure_ascii=False,
            indent=2
        )


def record_update_log(
    previous_items,
    current_items
):
    previous_by_id = {
        str(item.get("id")): item
        for item in previous_items
    }

    current_by_id = {
        str(item.get("id")): item
        for item in current_items
    }

    events = []

    update_time = (
        datetime.utcnow().isoformat()
        + "Z"
    )

    for puzzle in current_items:
        key = str(puzzle.get("id"))

        if key not in previous_by_id:
            events.append({
                "id": (
                    update_time
                    + "-"
                    + str(len(events))
                ),
                "time": update_time,
                "type": "Puzzle Added",
                "puzzleId": puzzle.get("id"),
                "puzzleNum": puzzle.get("num"),
                "title": puzzle.get("title"),
                "field": None
            })
            continue

        old_puzzle = previous_by_id[key]

        for field, label in UPDATE_FIELDS.items():
            old_value = old_puzzle.get(field)
            new_value = puzzle.get(field)

            if old_value != new_value:
                events.append({
                    "id": (
                        update_time
                        + "-"
                        + str(len(events))
                    ),
                    "time": update_time,
                    "type": label,
                    "puzzleId": puzzle.get("id"),
                    "puzzleNum": puzzle.get("num"),
                    "title": puzzle.get("title"),
                    "field": field
                })

    for puzzle in previous_items:
        key = str(puzzle.get("id"))

        if key not in current_by_id:
            events.append({
                "id": (
                    update_time
                    + "-"
                    + str(len(events))
                ),
                "time": update_time,
                "type": "Puzzle Removed",
                "puzzleId": puzzle.get("id"),
                "puzzleNum": puzzle.get("num"),
                "title": puzzle.get("title"),
                "field": None
            })

    return events


# ---------------------------------------------------------
# Update config
# ---------------------------------------------------------

def update_config():

    all_puzzles = []

    start = 0

    # -----------------------------------------------------
    # Read all LMD pages
    # -----------------------------------------------------

    while True:

        html = fetch_page(
            start
        )

        puzzles = parse_puzzles(
            html
        )

        if not puzzles:
            break

        all_puzzles.extend(
            puzzles
        )

        if len(puzzles) < 20:
            break

        start += 20

    print(
        f"Found {len(all_puzzles)} puzzles on LMD"
    )

    # -----------------------------------------------------
    # Load config
    # -----------------------------------------------------

    with open(
        CONFIG_PATH,
        "r",
        encoding="utf-8"
    ) as f:

        cfg = json.load(f)

    previous_items = json.loads(
        json.dumps(
            cfg.get("items", [])
        )
    )

    existing_lmd = {
        item["lmd"]: item
        for item in cfg["items"]
    }

    new_puzzles = []

    for p in all_puzzles:

        if p["lmd"] not in existing_lmd:

            new_puzzles.append(
                p
            )

    print(
        f"New puzzles: {len(new_puzzles)}"
    )

    # -----------------------------------------------------
    # Add new puzzles
    # -----------------------------------------------------

    for p in new_puzzles:

        puzz_link = ""
        image_path = ""

        try:

            puzzle_html = fetch_puzzle(
                p["lmd"]
            )

            puzz_link = get_sudokupad_link(
                puzzle_html
            )

            image_url = get_puzzle_image_url(
                puzzle_html
            )

            if image_url:

                image_path = download_image(
                    image_url,
                    p["lmd"]
                )

            if not p["date"]:

                p["date"] = extract_date(
                    puzzle_html
                )

        except Exception as e:

            print(
                f"Error fetching "
                f"{p['lmd']}: {e}"
            )

        new_id = (
            "ietsh-"
            +
            re.sub(
                r'[^a-z0-9]',
                '',
                p["title"].lower()
            )
        )

        new_item = {
            "num": 0,
            "id": new_id,
            "title": p["title"],
            "date": p["date"],
            "stars": p["stars"],
            "author_rated": p["author_rated"],
            "puzz": puzz_link,
            "lmd": p["lmd"],
            "solves": p["solved"],
            "sudokupad_solves": None,
            "rating": p["rating"],
            "image": image_path
        }

        cfg["items"].append(
            new_item
        )

        print(
            f"Added: {p['title']}"
        )

        time.sleep(
            0.5
        )

    # ---------------------------------------------------------
    # Backfill images for existing puzzles
    # ---------------------------------------------------------

    print(
        "Checking puzzle images..."
    )

    for item in cfg["items"]:

        image_before = item.get(
            "image",
            ""
        )

        image_after = ensure_puzzle_image(
            item
        )

        if image_after:

            item["image"] = image_after

            if image_before != image_after:

                print(
                    f"Image added: "
                    f"{item['title']} "
                    f"-> {image_after}"
                )

        else:

            # Make sure every item has the field
            # even if LMD has no image.
            if "image" not in item:
                item["image"] = ""

        time.sleep(
            0.2
        )

    # ---------------------------------------------------------
    # Update existing puzzle data
    # ---------------------------------------------------------

    with sync_playwright() as playwright:

        browser = playwright.chromium.launch(
            headless=True
        )

        page = browser.new_page(
            viewport={
                "width": 1280,
                "height": 900
            }
        )

        try:

            for item in cfg["items"]:

                for p in all_puzzles:

                    if p["lmd"] == item["lmd"]:

                        # Re-read the LMD puzzle page and bind
                        # the SudokuPad link to this exact LMD
                        # puzzle. This also repairs old config
                        # entries whose link was associated with
                        # another puzzle.
                        puzzle_html = ""

                        try:
                            puzzle_html = fetch_puzzle(
                                p["lmd"]
                            )
                        except Exception:
                            pass

                        if puzzle_html:

                            correct_puzz = (
                                get_sudokupad_link(
                                    puzzle_html
                                )
                            )

                            if correct_puzz:
                                item["puzz"] = correct_puzz

                        # The SudokuPad counter must always be
                        # read from the corrected link above.
                        update_sudokupad_solves(
                            item,
                            page
                        )

                        item["stars"] = p[
                            "stars"
                        ]

                        item["author_rated"] = p[
                            "author_rated"
                        ]

                        item["solves"] = p[
                            "solved"
                        ]

                        item["rating"] = p[
                            "rating"
                        ]

                        if p["date"]:

                            item["date"] = p[
                                "date"
                            ]

                        elif (
                            not item.get("date")
                            or item["date"] == ""
                        ):

                            try:

                                if not puzzle_html:
                                    puzzle_html = fetch_puzzle(
                                        p["lmd"]
                                    )

                                item["date"] = extract_date(
                                    puzzle_html
                                )

                            except Exception:
                                pass

                        print(
                            f"Updated: "
                            f"{item['title']} "
                            f"-> {p['stars']} stars, "
                            f"author_rated="
                            f"{p['author_rated']}, "
                            f"{p['solved']} solves, "
                            f"{p['rating']} | "
                            f"date: {item['date']} | "
                            f"SudokuPad: "
                            f"{item.get('puzz', '')} | "
                            f"counter: "
                            f"{item.get('sudokupad_solves')}"
                        )

                        break

        finally:

            browser.close()

    # ---------------------------------------------------------
    # Sort by date
    # ---------------------------------------------------------

    def parse_date(item):

        try:

            return datetime.strptime(
                item["date"],
                "%d. %B %Y, %H:%M"
            )

        except Exception:

            return datetime.min

    cfg["items"].sort(
        key=parse_date,
        reverse=True
    )

    # ---------------------------------------------------------
    # Numbering 
    # ---------------------------------------------------------

    for idx, item in enumerate(
        cfg["items"]
    ):

        item["num"] = (
            len(cfg["items"])
            - idx
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

    update_log = load_update_log()

    new_events = record_update_log(
        previous_items,
        cfg.get("items", [])
    )

    if new_events:
        update_log.extend(new_events)
        save_update_log(update_log)

        print(
            f"Recorded {len(new_events)} update events."
        )
    elif not os.path.isfile(UPDATE_LOG_PATH):
        save_update_log(update_log)

    print(
        "Config updated successfully."
    )


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

if __name__ == "__main__":
    update_config()
