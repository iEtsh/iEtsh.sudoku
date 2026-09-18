#!/usr/bin/env python3
"""
scraper.py

يقرأ كل صفحات iEtsh على LMD ويحدث config.json
ويضيف الألغاز الجديدة تلقائيًا.

بالإضافة إلى ذلك:
- يستخرج صورة كل Puzzle من صفحة LMD.
- يحفظ الصور محليًا داخل:
  sudoku-ietsh/ietsh/lmd/images/
- يضيف مسار الصورة داخل config.json.
- يعمل Backfill تلقائي لأي Puzzle قديمة لا تملك صورة.

النجوم:
- levelX.png  = تقييم عادي → author_rated = false
- ulevelX.png = تقييم المؤلف → author_rated = true
"""

import json
import os
import re
import time
import requests
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

CONFIG_PATH = "sudoku-ietsh/ietsh/lmd/config.json"

IMAGE_DIR = "sudoku-ietsh/ietsh/lmd/images"


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
    "Dezember": "December",
}


# =============================================================
# HTTP
# =============================================================

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
    url = PUZZLE_BASE_URL + lmd_code

    r = requests.get(
        url,
        headers=HEADERS,
        timeout=30
    )

    r.raise_for_status()

    return r.text


def download_image(url, lmd_code):
    """
    Downloads the puzzle image and saves it locally.

    Returns:
        relative path such as:
        images/000UVR.png

    Returns empty string if the image cannot be downloaded.
    """

    if not url:
        return ""

    os.makedirs(
        IMAGE_DIR,
        exist_ok=True
    )

    try:
        r = requests.get(
            url,
            headers=HEADERS,
            timeout=30
        )

        r.raise_for_status()

        content_type = (
            r.headers.get(
                "Content-Type",
                ""
            )
            .lower()
        )

        # -----------------------------------------------------
        # Determine extension
        # -----------------------------------------------------

        if "png" in content_type:
            extension = "png"

        elif "jpeg" in content_type or "jpg" in content_type:
            extension = "jpg"

        elif "webp" in content_type:
            extension = "webp"

        elif "gif" in content_type:
            extension = "gif"

        else:
            # LMD puzzle images are normally PNG/JPEG.
            # PNG is used as the safe fallback.
            extension = "png"

        filename = (
            f"{lmd_code}.{extension}"
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
                r.content
            )

        relative_path = (
            f"images/{filename}"
        )

        print(
            f"Image saved: "
            f"{relative_path}"
        )

        return relative_path

    except Exception as e:

        print(
            f"Error downloading image "
            f"for {lmd_code}: {e}"
        )

        return ""


# =============================================================
# Parsing helpers
# =============================================================

def extract_date(text):

    patterns = [
        r"(\d{1,2}\.\s+\w+\s+\d{4},\s+\d{1,2}:\d{2})",
        r"(\d{4}-\d{2}-\d{2})",
        r"(\d{1,2}/\d{1,2}/\d{4})",
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


def get_sudokupad_link(html):

    soup = BeautifulSoup(
        html,
        "html.parser"
    )

    for a in soup.find_all(
        "a",
        href=True
    ):

        if a.find("img"):

            href = a["href"]

            if "sudokupad" in href.lower():

                return href

    return ""


def get_puzzle_image_url(html):

    """
    Finds the actual puzzle image inside the LMD puzzle page.

    LMD images are normally served from /Dateien/.
    We intentionally prefer bild.php because that is the
    image endpoint used by LMD.
    """

    soup = BeautifulSoup(
        html,
        "html.parser"
    )

    candidates = []

    for img in soup.find_all(
        "img",
        src=True
    ):

        src = img.get(
            "src",
            ""
        ).strip()

        if not src:
            continue

        absolute_url = urljoin(
            "https://logic-masters.de/",
            src
        )

        lower_url = absolute_url.lower()

        # Strong match:
        # LMD stored puzzle images.
        if "/dateien/bild.php" in lower_url:

            return absolute_url

        # Secondary candidate:
        # Other files under /Dateien/.
        if "/dateien/" in lower_url:

            candidates.append(
                absolute_url
            )

    if candidates:

        return candidates[0]

    return ""


# =============================================================
# Puzzle list parser
# =============================================================

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

        # -----------------------------------------------------
        # Puzzle title + LMD code
        # -----------------------------------------------------

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

        # -----------------------------------------------------
        # Date
        # -----------------------------------------------------

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

        # -----------------------------------------------------
        # Solves
        # -----------------------------------------------------

        solved_text = cells[2].get_text(
            strip=True
        )

        solved_match = re.match(
            r"(\d+)",
            solved_text.strip()
        )

        if solved_match:

            full_num = solved_match.group(1)

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

        # -----------------------------------------------------
        # Difficulty / Stars
        # -----------------------------------------------------

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

            # -------------------------------------------------
            # Author estimated difficulty
            # -------------------------------------------------

            m = re.search(
                r"ulevel(\d)\.png",
                src
            )

            if m:

                stars = int(
                    m.group(1)
                )

                author_rated = True

            else:

                # ---------------------------------------------
                # Normal evaluated difficulty
                # ---------------------------------------------

                m = re.search(
                    r"level(\d)\.png",
                    src
                )

                if m:

                    stars = int(
                        m.group(1)
                    )

                    author_rated = False

        # -----------------------------------------------------
        # Rating
        # -----------------------------------------------------

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


# =============================================================
# Image handling
# =============================================================

def ensure_puzzle_image(item):
    """
    Ensures that a puzzle has a local image.

    If the image already exists, nothing is downloaded.

    If the image is missing:
        1. Fetch puzzle page
        2. Extract image URL
        3. Download image
        4. Store relative image path in config
    """

    existing_image = item.get(
        "image",
        ""
    )

    if existing_image:

        local_path = os.path.join(
            "sudoku-ietsh/ietsh/lmd",
            existing_image
        )

        if os.path.exists(
            local_path
        ):

            return existing_image

    lmd_code = item.get(
        "lmd",
        ""
    )

    if not lmd_code:
        return ""

    try:

        print(
            f"Fetching image for "
            f"{lmd_code}..."
        )

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

        print(
            f"Image URL: {image_url}"
        )

        image_path = download_image(
            image_url,
            lmd_code
        )

        return image_path

    except Exception as e:

        print(
            f"Error getting image "
            f"for {lmd_code}: {e}"
        )

        return ""


# =============================================================
# Main update
# =============================================================

def update_config():

    all_puzzles = []

    start = 0

    # ---------------------------------------------------------
    # Read all LMD pages
    # ---------------------------------------------------------

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

    # ---------------------------------------------------------
    # Load config
    # ---------------------------------------------------------

    with open(
        CONFIG_PATH,
        "r",
        encoding="utf-8"
    ) as f:

        cfg = json.load(
            f
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
        f"New puzzles: "
        f"{len(new_puzzles)}"
    )

    # ---------------------------------------------------------
    # Add new puzzles
    # ---------------------------------------------------------

    for p in new_puzzles:

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

            image_path = ""

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

            puzz_link = ""
            image_path = ""

        new_id = (
            "ietsh-"
            +
            re.sub(
                r"[^a-z0-9]",
                "",
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
    # Update existing puzzles
    # ---------------------------------------------------------

    for item in cfg["items"]:

        for p in all_puzzles:

            if p["lmd"] != item["lmd"]:
                continue

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

                    puzzle_html = fetch_puzzle(
                        p["lmd"]
                    )

                    item["date"] = extract_date(
                        puzzle_html
                    )

                except Exception:
                    pass

            # -------------------------------------------------
            # Image backfill
            # -------------------------------------------------

            image_path = ensure_puzzle_image(
                item
            )

            if image_path:

                item["image"] = image_path

            elif "image" not in item:

                item["image"] = ""

            print(
                f"Updated: {item['title']} "
                f"-> {p['stars']} stars, "
                f"author_rated={p['author_rated']}, "
                f"{p['solved']} solves, "
                f"{p['rating']} | "
                f"date: {item['date']} | "
                f"image: "
                f"{item.get('image', '')}"
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

    print(
        "Config updated successfully."
    )


if __name__ == "__main__":
    update_config()
