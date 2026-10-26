#!/usr/bin/env python3
"""Sync current LMD puzzle data and record snapshots only for real changes."""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from supabase import create_client

ROOT = Path(__file__).resolve().parent
LOCAL_TZ = ZoneInfo("Europe/Berlin")
TRACKED_FIELDS = (
    "lmd_solves",
    "sudokupad_solves",
    "rating_percent",
    "difficulty_stars",
)


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


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def read_confirmed_removals():
    """Use explicit removal events created by the validated LMD listing scan."""
    path = ROOT / "update-log.json"
    if not path.exists():
        return set()
    try:
        events = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Cannot safely read update log: {exc}") from exc

    removed_codes = set()
    for event in events:
        if event.get("type") != "Puzzle Removed":
            continue
        previous = event.get("previous") or {}
        code = str(previous.get("lmd", "")).strip()
        if code:
            removed_codes.add(code)
    return removed_codes


def same_metrics(previous, current):
    # Python considers None == None, so unavailable values do not create false changes.
    return all(previous.get(field) == current.get(field) for field in TRACKED_FIELDS)


def main():
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_KEY"]
    client = create_client(url, key)

    with (ROOT / "config.json").open(encoding="utf-8") as file:
        config = json.load(file)

    items = config.get("items", [])
    if not isinstance(items, list) or not items:
        raise ValueError("No puzzle records found; refusing an empty sync")

    # Capture when this sync actually observed the values. config.last_check remains
    # the scraper's source-check time and is stored separately on current records.
    captured_at = utc_now()
    source_checked_at = config.get("last_check") or captured_at
    current_rows = []
    seen = set()

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
            "lmd_solves": integer(item.get("solves")),
            "sudokupad_solves": integer(item.get("sudokupad_solves")),
            "rating_percent": percentage(item.get("rating")),
            "image_path": item.get("image") or None,
            "source_updated_at": source_checked_at,
            "last_seen_at": captured_at,
            "is_active": True,
        })

    if not current_rows:
        raise ValueError("No valid puzzle records found; refusing an empty sync")

    # Read existing records and latest snapshots before making any writes.
    existing_response = client.table("lmd_puzzles").select(
        "lmd_code,is_active,last_seen_at"
    ).execute()
    existing_by_code = {
        row["lmd_code"]: row for row in (existing_response.data or [])
    }

    snapshots_to_insert = []
    for row in current_rows:
        response = (
            client.table("lmd_puzzle_snapshots")
            .select("lmd_solves,sudokupad_solves,rating_percent,difficulty_stars,captured_at")
            .eq("lmd_code", row["lmd_code"])
            .order("captured_at", desc=True)
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        latest = response.data[0] if response.data else None
        if latest is None or not same_metrics(latest, row):
            snapshots_to_insert.append({
                "lmd_code": row["lmd_code"],
                "captured_at": captured_at,
                **{field: row[field] for field in TRACKED_FIELDS},
            })

    # Current-state upserts happen on every run; this does not imply a history row.
    for offset in range(0, len(current_rows), 500):
        client.table("lmd_puzzles").upsert(
            current_rows[offset:offset + 500], on_conflict="lmd_code"
        ).execute()

    for offset in range(0, len(snapshots_to_insert), 500):
        client.table("lmd_puzzle_snapshots").insert(
            snapshots_to_insert[offset:offset + 500]
        ).execute()

    # Only mark removals that the scraper's explicit removal step recorded.
    # Missing from config alone is not enough: a partial/failed scrape must not
    # deactivate records or erase their history.
    confirmed_removed = read_confirmed_removals()
    for code in sorted(confirmed_removed - seen):
        if code in existing_by_code:
            client.table("lmd_puzzles").update({
                "is_active": False
            }).eq("lmd_code", code).execute()

    print(
        f"Synced {len(current_rows)} current puzzles; "
        f"saved {len(snapshots_to_insert)} changed/new snapshots; "
        f"marked {len(confirmed_removed - seen)} confirmed removals inactive."
    )


if __name__ == "__main__":
    main()
