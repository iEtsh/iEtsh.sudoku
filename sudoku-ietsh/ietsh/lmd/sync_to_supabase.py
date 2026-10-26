#!/usr/bin/env python3
"""Load LMD puzzle metrics from config.json into Supabase."""
import json
import os
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from supabase import create_client

ROOT = Path(__file__).resolve().parent
LOCAL_TZ = ZoneInfo("Europe/Berlin")


def integer(value):
    try:
        return int(value) if value not in (None, "", "N/A") else None
    except (TypeError, ValueError):
        return None


def percentage(value):
    if value is None or "N/A" in str(value).upper():
        return None
    match = re.search(r"(\d+)", str(value))
    return int(match.group(1)) if match and 0 <= int(match.group(1)) <= 100 else None


def published_at(value):
    try:
        return datetime.strptime(value, "%d. %B %Y, %H:%M").replace(tzinfo=LOCAL_TZ).isoformat()
    except (TypeError, ValueError):
        return None


def main():
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_KEY"]
    client = create_client(url, key)

    with (ROOT / "config.json").open(encoding="utf-8") as file:
        config = json.load(file)
    items = config.get("items", [])
    captured_at = config.get("last_check") or datetime.now(LOCAL_TZ).isoformat()
    current_rows, snapshots, seen = [], [], set()

    for item in items:
        code = str(item.get("lmd", "")).strip()
        if not code:
            continue
        if code in seen:
            raise ValueError(f"Duplicate LMD code: {code}")
        seen.add(code)

        stars = integer(item.get("stars"))
        if stars is not None and not 1 <= stars <= 5:
            stars = None
        lmd_solves = integer(item.get("solves"))
        pad_solves = integer(item.get("sudokupad_solves"))
        rating = percentage(item.get("rating"))

        current_rows.append({
            "lmd_code": code,
            "puzzle_id": item.get("id"),
            "puzzle_num": integer(item.get("num")),
            "title": str(item.get("title") or code),
            "published_at": published_at(item.get("date")),
            "published_date_raw": item.get("date") or None,
            "difficulty_stars": stars,
            "author_rated": bool(item.get("author_rated", False)),
            "sudokupad_url": item.get("puzz") or None,
            "lmd_solves": lmd_solves,
            "sudokupad_solves": pad_solves,
            "rating_percent": rating,
            "image_path": item.get("image") or None,
            "source_updated_at": captured_at,
        })
        snapshots.append({
            "lmd_code": code,
            "captured_at": captured_at,
            "lmd_solves": lmd_solves,
            "sudokupad_solves": pad_solves,
            "rating_percent": rating,
            "difficulty_stars": stars,
        })

    if not current_rows:
        raise ValueError("No puzzle records found; refusing an empty sync")

    for offset in range(0, len(current_rows), 500):
        client.table("lmd_puzzles").upsert(
            current_rows[offset:offset + 500], on_conflict="lmd_code"
        ).execute()
    for offset in range(0, len(snapshots), 500):
        client.table("lmd_puzzle_snapshots").insert(
            snapshots[offset:offset + 500]
        ).execute()

    print(f"Synced {len(current_rows)} puzzles and saved {len(snapshots)} history snapshots.")


if __name__ == "__main__":
    main()
