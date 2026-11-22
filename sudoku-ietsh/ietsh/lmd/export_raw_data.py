#!/usr/bin/env python3
"""Export raw LMD source tables to a simple Excel workbook (no dashboard/charts)."""
import json
import os
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from supabase import create_client
from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent
OUTPUT = Path(os.environ.get("RAW_DATA_XLSX", ROOT / "exports" / "iEtsh_LMD_Raw_Data.xlsx"))
PAGE_SIZE = 1000


def fetch_all(client, table, order_column):
    rows = []
    offset = 0
    while True:
        response = (
            client.table(table).select("*").order(order_column)
            .range(offset, offset + PAGE_SIZE - 1).execute()
        )
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


def excel_value(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, default=str)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def write_source_table(wb, sheet_name, table_name, title, rows):
    ws = wb.create_sheet(sheet_name)
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "A2"
    if not rows:
        ws.append(["No records returned"])
        ws.column_dimensions["A"].width = 24
        return

    headers = list(dict.fromkeys(key for row in rows for key in row.keys()))
    ws.append(headers)
    for row in rows:
        ws.append([excel_value(row.get(header)) for header in headers])

    last_col = get_column_letter(len(headers))
    last_row = len(rows) + 1
    table = Table(displayName=table_name, ref=f"A1:{last_col}{last_row}")
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    ws.add_table(table)

    for index, header in enumerate(headers, 1):
        sample_width = max(
            [len(str(header))]
            + [min(len(str(row.get(header) or "")), 48) for row in rows[:150]]
        )
        ws.column_dimensions[get_column_letter(index)].width = min(max(sample_width + 2, 13), 42)

    # Excel Tables already own their AutoFilter. Do not add ws.auto_filter here:
    # duplicating the filter at worksheet level can make Excel repair and discard the Table.
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def main():
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_KEY"]
    client = create_client(url, key)

    puzzles = fetch_all(client, "lmd_puzzles", "lmd_code")
    snapshots = fetch_all(client, "lmd_puzzle_snapshots", "captured_at")
    if not puzzles:
        raise RuntimeError("Supabase returned no lmd_puzzles rows; refusing to create an empty workbook.")

    # Snapshots store lmd_code as their relational key. Enrich each observation
    # with the human-readable puzzle title before exporting it for analysis.
    puzzle_by_code = {p["lmd_code"]: p for p in puzzles}
    snapshot_rows = []
    for snapshot in snapshots:
        code = snapshot.get("lmd_code")
        puzzle = puzzle_by_code.get(code, {})
        snapshot_rows.append({
            "Puzzle": puzzle.get("title") or code or "Unknown puzzle",
            "LMD Code (technical)": code,
            **{key: value for key, value in snapshot.items() if key != "lmd_code"},
        })

    wb = Workbook()
    wb.remove(wb.active)
    rows_by_sheet = {"Puzzles": puzzles, "Snapshots": snapshot_rows}
    write_source_table(wb, "Puzzles", "PuzzlesData", "Current puzzle data", puzzles)
    write_source_table(wb, "Snapshots", "SnapshotsData", "Historical snapshots", snapshot_rows)
    wb.properties.title = "iEtsh LMD Raw Data"
    wb.properties.subject = "Raw rows from the Supabase LMD source tables"
    wb.properties.creator = "iEtsh"
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUTPUT)

    # Validate the generated XLSX before GitHub Actions is allowed to publish it.
    # This catches malformed ZIP/XML parts and verifies that Excel Tables survive a round-trip.
    with zipfile.ZipFile(OUTPUT, "r") as archive:
        bad_member = archive.testzip()
        if bad_member:
            raise RuntimeError(f"Corrupt XLSX archive member: {bad_member}")
        for member in archive.namelist():
            if member.endswith(".xml") or member.endswith(".rels"):
                try:
                    ET.fromstring(archive.read(member))
                except ET.ParseError as exc:
                    raise RuntimeError(f"Invalid XML in XLSX member {member}: {exc}") from exc

    check_wb = load_workbook(OUTPUT, read_only=False, data_only=False)
    try:
        expected_tables = {"Puzzles": "PuzzlesData", "Snapshots": "SnapshotsData"}
        for sheet_name, table_name in expected_tables.items():
            if sheet_name not in check_wb.sheetnames:
                raise RuntimeError(f"Validation failed: missing worksheet {sheet_name}")
            check_ws = check_wb[sheet_name]
            if rows_by_sheet[sheet_name] and table_name not in check_ws.tables:
                raise RuntimeError(f"Validation failed: missing Excel Table {table_name}")
            if check_ws.tables and check_ws.auto_filter.ref:
                raise RuntimeError(
                    f"Validation failed: duplicate worksheet-level AutoFilter on {sheet_name}"
                )
    finally:
        check_wb.close()

    print(
        f"Created {OUTPUT} | puzzles={len(puzzles)} | snapshots={len(snapshots)} "
        f"| bytes={OUTPUT.stat().st_size}"
    )


if __name__ == "__main__":
    main()
