#!/usr/bin/env python3
"""Export the complete LMD Supabase analytics database to a formatted Excel workbook."""
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from supabase import create_client
from openpyxl import Workbook
from openpyxl.chart import LineChart, BarChart, Reference, DoughnutChart, ScatterChart, Series
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.chart.label import DataLabelList
from openpyxl.formatting.rule import ColorScaleRule, DataBarRule
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent
OUTPUT = Path(os.environ.get("OUTPUT_XLSX", ROOT / "iEtsh_LMD_Analytics.xlsx"))
PAGE_SIZE = 1000

NAVY = "14243A"
BLUE = "2673B8"
CYAN = "20B8C5"
PALE = "EAF2F8"
LIGHT = "F4F7FA"
WHITE = "FFFFFF"
GREEN = "16856B"
ORANGE = "E69A36"
RED = "C94C4C"
GREY = "68788A"


def fetch_all(client, table, order_column):
    rows, offset = [], 0
    while True:
        response = (
            client.table(table).select("*").order(order_column)
            .range(offset, offset + PAGE_SIZE - 1).execute()
        )
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def as_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def style_title(ws, title, subtitle, end_col):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=end_col)
    c = ws.cell(1, 1, title)
    c.font = Font(name="Aptos Display", size=20, bold=True, color=WHITE)
    c.fill = PatternFill("solid", fgColor=NAVY)
    c.alignment = Alignment(vertical="center")
    ws.row_dimensions[1].height = 36
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=end_col)
    c = ws.cell(2, 1, subtitle)
    c.font = Font(name="Aptos", size=10, italic=True, color=GREY)
    c.fill = PatternFill("solid", fgColor=PALE)
    ws.row_dimensions[2].height = 23


def write_table(ws, title, headers, rows, table_name, widths=None):
    style_title(ws, title, f"{len(rows):,} records | Source: Supabase LMD analytics", len(headers))
    header_row = 4
    for col, header in enumerate(headers, 1):
        cell = ws.cell(header_row, col, header)
        cell.font = Font(bold=True, color=WHITE)
        cell.fill = PatternFill("solid", fgColor=BLUE)
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[header_row].height = 30
    for r_idx, row in enumerate(rows, header_row + 1):
        for c_idx, value in enumerate(row, 1):
            cell = ws.cell(r_idx, c_idx, value)
            cell.alignment = Alignment(vertical="top")
            if r_idx % 2 == 0:
                cell.fill = PatternFill("solid", fgColor=LIGHT)
    last_row = header_row + len(rows)
    if rows:
        ref = f"A{header_row}:{get_column_letter(len(headers))}{last_row}"
        tab = Table(displayName=table_name, ref=ref)
        tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True,
                                            showColumnStripes=False, showFirstColumn=False,
                                            showLastColumn=False)
        ws.add_table(tab)
    ws.freeze_panes = "A5"
    # Excel Tables already contain their own AutoFilter definition.
    # Adding a worksheet-level AutoFilter over the same range creates duplicate
    # filter metadata that can make Excel repair and discard the Table on open.
    ws.sheet_view.showGridLines = False
    for col, header in enumerate(headers, 1):
        width = (widths or {}).get(header, min(max(len(header) + 3, 14), 30))
        ws.column_dimensions[get_column_letter(col)].width = width
    return header_row, last_row



def build_power_bi(wb, active, puzzles, snapshots, trend_rows):
    ws = wb.create_sheet("Power BI", 1)
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 80
    ws.freeze_panes = "A8"
    BG, PANEL, PANEL2 = "101B2B", "192A40", "20364F"
    WHITE, MUTED = "F3F7FC", "A8B8CA"
    LMD, SP, GREEN, AMBER, PURPLE = "36C6D2", "A78BFA", "55C59A", "F5B65C", "B69CFF"
    for col in range(1,17):
        ws.column_dimensions[get_column_letter(col)].width = 14
    for col in range(27,51):
        ws.column_dimensions[get_column_letter(col)].hidden = True
    ws.merge_cells("A1:P1"); ws["A1"]="iEtsh  /  PUZZLE INTELLIGENCE"
    ws["A1"].font=Font(name="Aptos Display",size=23,bold=True,color=WHITE)
    ws["A1"].fill=PatternFill("solid",fgColor=BG); ws.row_dimensions[1].height=44
    ws.merge_cells("A2:P2"); ws["A2"]="ADVANCED BI OVERVIEW   •   PERFORMANCE  /  PLATFORM MIX  /  HISTORICAL MOMENTUM"
    ws["A2"].font=Font(size=9,bold=True,color=MUTED); ws["A2"].fill=PatternFill("solid",fgColor=BG)
    ws.merge_cells("A3:P3"); ws["A3"]=f"{len(active):,} active puzzles  •  {len(snapshots):,} historical observations  •  Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
    ws["A3"].font=Font(size=9,color=MUTED); ws["A3"].fill=PatternFill("solid",fgColor=BG)
    lmd=sum(p.get("lmd_solves") or 0 for p in active); sp=sum(p.get("sudokupad_solves") or 0 for p in active)
    combined=lmd+sp
    ratings=[p["rating_percent"] for p in active if p.get("rating_percent") is not None]
    diffs=[p["difficulty_stars"] for p in active if p.get("difficulty_stars") is not None]
    cards=[("PUZZLES",len(puzzles),LMD,"#,##0"),("COMBINED SOLVES",combined,GREEN,"#,##0"),
           ("LMD SOLVES",lmd,LMD,"#,##0"),("SUDOKUPAD SOLVES",sp,SP,"#,##0"),
           ("AVG RATING",sum(ratings)/len(ratings) if ratings else None,AMBER,'0.0"%"'),
           ("AVG DIFFICULTY",sum(diffs)/len(diffs) if diffs else None,PURPLE,'0.00" ★"')]
    for i,(label,value,color,fmt) in enumerate(cards):
        a=1+i*2; b=a+1
        ws.merge_cells(start_row=5,start_column=a,end_row=5,end_column=b)
        ws.merge_cells(start_row=6,start_column=a,end_row=7,end_column=b)
        for rr in (5,6,7):
            for cc in (a,b): ws.cell(rr,cc).fill=PatternFill("solid",fgColor=PANEL)
        h=ws.cell(5,a,label); h.font=Font(size=8,bold=True,color=MUTED); h.alignment=Alignment(horizontal="center")
        v=ws.cell(6,a,value); v.font=Font(name="Aptos Display",size=20,bold=True,color=color); v.number_format=fmt
        v.alignment=Alignment(horizontal="center",vertical="center")
        h.border=Border(top=Side(style="medium",color=color))
    for row,title in [(8,"01  /  PERFORMANCE & MOMENTUM"),(27,"02  /  AUDIENCE, REACH & QUALITY"),(48,"03  /  DIFFICULTY & CATALOG INTELLIGENCE")]:
        ws.merge_cells(start_row=row,start_column=1,end_row=row,end_column=16)
        c=ws.cell(row,1,title); c.font=Font(bold=True,size=11,color=WHITE); c.fill=PatternFill("solid",fgColor=PANEL2)
        ws.row_dimensions[row].height=25
    helper=27
    def data_block(title,headers,rows):
        nonlocal helper
        start=helper; ws.cell(1,start,title)
        for j,x in enumerate(headers): ws.cell(2,start+j,x)
        for i,row in enumerate(rows,3):
            for j,x in enumerate(row): ws.cell(i,start+j,x)
        helper+=max(3,len(headers)+1)
        return start,len(rows)
    # Change-driven snapshots: chart the reconstructed latest-known state, not timestamp-only partial sums.
    c,n=data_block("Historical totals",["Captured at","LMD","SudokuPad"],[[r[0],r[1],r[2]] for r in trend_rows if r[0]])
    if n:
        ch=LineChart(); ch.title="Recorded solve volume over time"; ch.style=13; ch.height=9; ch.width=17
        ch.y_axis.title="Solves"; ch.x_axis.title="Snapshot date"; ch.legend.position="b"
        ch.add_data(Reference(ws,min_col=c+1,max_col=c+2,min_row=2,max_row=2+n),titles_from_data=True)
        ch.set_categories(Reference(ws,min_col=c,min_row=3,max_row=2+n))
        for ser,color in zip(ch.series,(LMD,SP)):
            ser.graphicalProperties.line.solidFill=color; ser.graphicalProperties.line.width=26000; ser.smooth=True
        ws.add_chart(ch,"A9")
    top=sorted(active,key=lambda p:(p.get("lmd_solves") or 0)+(p.get("sudokupad_solves") or 0),reverse=True)[:12]
    c,n=data_block("Top puzzles",["Puzzle","Combined solves"],[[(p.get("title") or p.get("lmd_code") or "Untitled")[:40],(p.get("lmd_solves") or 0)+(p.get("sudokupad_solves") or 0)] for p in top])
    if n:
        ch=BarChart(); ch.type="bar"; ch.style=10; ch.title="Top 12 puzzles • combined solves"; ch.height=9; ch.width=17
        ch.legend=None; ch.add_data(Reference(ws,min_col=c+1,min_row=2,max_row=2+n),titles_from_data=True)
        ch.set_categories(Reference(ws,min_col=c,min_row=3,max_row=2+n))
        ch.series[0].graphicalProperties.solidFill=LMD; ch.series[0].graphicalProperties.line.solidFill=LMD
        ws.add_chart(ch,"I9")
    c,n=data_block("Platform mix",["Platform","Solves"],[["LMD",lmd],["SudokuPad",sp]])
    if combined:
        ch=DoughnutChart(); ch.title="Platform share of recorded solves"; ch.style=10; ch.height=9; ch.width=13; ch.holeSize=62
        ch.add_data(Reference(ws,min_col=c+1,min_row=2,max_row=4),titles_from_data=True)
        ch.set_categories(Reference(ws,min_col=c,min_row=3,max_row=4))
        ch.dataLabels=DataLabelList(); ch.dataLabels.showPercent=True
        from openpyxl.chart.series import DataPoint
        ch.series[0].data_points=[DataPoint(idx=0,spPr=GraphicalProperties(solidFill=LMD)),DataPoint(idx=1,spPr=GraphicalProperties(solidFill=SP))]
        ws.add_chart(ch,"A28")
    scatter=[[p.get("rating_percent"),(p.get("lmd_solves") or 0)+(p.get("sudokupad_solves") or 0)] for p in active if p.get("rating_percent") is not None]
    c,n=data_block("Rating and reach",["Rating %","Combined solves"],scatter)
    if n:
        ch=ScatterChart(); ch.title="Community rating vs audience reach"; ch.style=13; ch.height=13; ch.width=17
        ch.x_axis.title="Rating (%)"; ch.y_axis.title="Combined solves"; ch.legend=None
        ser=Series(Reference(ws,min_col=c+1,min_row=3,max_row=2+n),Reference(ws,min_col=c,min_row=3,max_row=2+n),title="Puzzles")
        ser.graphicalProperties.line.noFill=True; ser.graphicalProperties.solidFill=PURPLE
        ser.marker.symbol="circle"; ser.marker.size=6; ch.series.append(ser); ws.add_chart(ch,"H28")
    groups=defaultdict(list)
    for p in active:
        if p.get("difficulty_stars") is not None: groups[p["difficulty_stars"]].append(p)
    difficulty=[]
    for d,items in sorted(groups.items()):
        vals=[(p.get("lmd_solves") or 0)+(p.get("sudokupad_solves") or 0) for p in items]
        rs=[p["rating_percent"] for p in items if p.get("rating_percent") is not None]
        difficulty.append([d,len(items),round(sum(vals)/len(vals),1),round(sum(rs)/len(rs),1) if rs else None])
    c,n=data_block("Difficulty profile",["Stars","Puzzle count","Avg combined solves","Avg rating %"],difficulty)
    if n:
        ch=BarChart(); ch.type="col"; ch.style=12; ch.title="Average reach by difficulty"; ch.y_axis.title="Average combined solves"
        ch.x_axis.title="Difficulty (stars)"; ch.height=10; ch.width=17; ch.legend=None
        ch.add_data(Reference(ws,min_col=c+2,min_row=2,max_row=2+n),titles_from_data=True)
        ch.set_categories(Reference(ws,min_col=c,min_row=3,max_row=2+n))
        ch.series[0].graphicalProperties.solidFill=AMBER; ch.series[0].graphicalProperties.line.solidFill=AMBER
        ws.add_chart(ch,"A49")
    first=trend_rows[0] if trend_rows else None; last=trend_rows[-1] if trend_rows else None
    growth=None
    if first and last and (first[1] or 0)+(first[2] or 0):
        growth=(((last[1] or 0)+(last[2] or 0))/((first[1] or 0)+(first[2] or 0))-1)*100
    ws.merge_cells("I49:P49"); ws["I49"]="SIGNALS & DATA NOTES"
    ws["I49"].font=Font(bold=True,color=WHITE,size=11); ws["I49"].fill=PatternFill("solid",fgColor=PANEL)
    notes=[("HISTORICAL GROWTH",f"{growth:+.1f}%" if growth is not None else "Baseline unavailable"),
           ("RATING COVERAGE",f"{len(ratings):,} / {len(active):,} puzzles"),
           ("DIFFICULTY COVERAGE",f"{len(diffs):,} / {len(active):,} puzzles"),
           ("LATEST HISTORY",f"{last[4]:,} puzzles with observations" if last else "No saved snapshots"),
           ("PLATFORM MIX","LMD and SudokuPad counts are separate platform totals."),
           ("HISTORY METHOD","Latest-known state after each event; puzzles enter after first observation."),
           ("MISSING VALUES","Rating and difficulty averages exclude blank values.")]
    for i,(label,value) in enumerate(notes,50):
        ws.merge_cells(start_row=i,start_column=9,end_row=i,end_column=10)
        ws.merge_cells(start_row=i,start_column=11,end_row=i,end_column=16)
        a=ws.cell(i,9,label); a.font=Font(bold=True,size=8,color=MUTED); a.fill=PatternFill("solid",fgColor=PANEL)
        b=ws.cell(i,11,value); b.font=Font(size=9,color=WHITE); b.fill=PatternFill("solid",fgColor=PANEL2)
        a.alignment=Alignment(vertical="center",wrap_text=True); b.alignment=Alignment(vertical="center",wrap_text=True)
        ws.row_dimensions[i].height=34 if len(value)>72 else 25
    for row in ws.iter_rows(min_row=1,max_row=57,min_col=1,max_col=16):
        for cell in row:
            if cell.fill.fill_type is None: cell.fill=PatternFill("solid",fgColor=BG)
    ws.sheet_properties.tabColor=PURPLE
    ws.print_area="A1:P57"

def main():
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_KEY"]
    client = create_client(url, key)

    puzzles = fetch_all(client, "lmd_puzzles", "lmd_code")
    snapshots = fetch_all(client, "lmd_puzzle_snapshots", "captured_at")
    if not puzzles:
        raise RuntimeError("Supabase returned no lmd_puzzles rows; refusing to create an empty workbook.")

    puzzle_by_code = {p["lmd_code"]: p for p in puzzles}
    snapshots.sort(key=lambda x: (x.get("captured_at") or "", x.get("id") or 0))
    now = datetime.now(timezone.utc).replace(microsecond=0)
    wb = Workbook()
    dash = wb.active
    dash.title = "Analytics Dashboard"
    dash.sheet_view.showGridLines = False
    dash.merge_cells("A1:L1")
    dash["A1"] = "iEtsh | LMD Analytics Dashboard"
    dash["A1"].font = Font(name="Aptos Display", size=24, bold=True, color=WHITE)
    dash["A1"].fill = PatternFill("solid", fgColor=NAVY)
    dash["A1"].alignment = Alignment(vertical="center")
    dash.row_dimensions[1].height = 46
    dash.merge_cells("A2:L2")
    dash["A2"] = f"Complete database export • Generated {now.isoformat()} • Historical snapshots from Supabase"
    dash["A2"].font = Font(size=10, italic=True, color=GREY)
    dash["A2"].fill = PatternFill("solid", fgColor=PALE)

    active = [p for p in puzzles if p.get("is_active", True)]
    total_lmd = sum(p.get("lmd_solves") or 0 for p in active)
    total_sp = sum(p.get("sudokupad_solves") or 0 for p in active)
    ratings = [p["rating_percent"] for p in active if p.get("rating_percent") is not None]
    metrics = [
        ("TOTAL PUZZLES", len(puzzles)),
        ("ACTIVE PUZZLES", len(active)),
        ("HISTORICAL SNAPSHOTS", len(snapshots)),
        ("LMD SOLVES", total_lmd),
        ("SUDOKUPAD SOLVES", total_sp),
        ("AVG. RATING", round(sum(ratings) / len(ratings), 1) if ratings else None),
    ]
    positions = [("A4", "A5"), ("C4", "C5"), ("E4", "E5"), ("G4", "G5"), ("I4", "I5"), ("K4", "K5")]
    for (label, value), (label_cell, value_cell) in zip(metrics, positions):
        dash[label_cell] = label
        dash[label_cell].font = Font(bold=True, size=9, color=GREY)
        dash[label_cell].fill = PatternFill("solid", fgColor=PALE)
        dash[value_cell] = value
        dash[value_cell].font = Font(bold=True, size=19, color=NAVY)
        dash[value_cell].fill = PatternFill("solid", fgColor=LIGHT)
        dash[value_cell].number_format = '0.0"%"' if label == "AVG. RATING" else '#,##0'

    # Reconstruct the latest-known state of every puzzle after each snapshot event.
    # Snapshots are change-driven and may be sparse, so summing only rows sharing
    # an exact timestamp would produce misleading partial totals.
    state = {}
    by_time = defaultdict(list)
    for snap in snapshots:
        if snap.get("captured_at"):
            by_time[snap["captured_at"]].append(snap)
    trend_rows = []
    for stamp in sorted(by_time):
        for snap in by_time[stamp]:
            state[snap["lmd_code"]] = snap
        known = list(state.values())
        lmd_total = sum(x.get("lmd_solves") or 0 for x in known)
        sp_total = sum(x.get("sudokupad_solves") or 0 for x in known)
        rating_values = [x["rating_percent"] for x in known if x.get("rating_percent") is not None]
        avg_rating = round(sum(rating_values) / len(rating_values), 2) if rating_values else None
        trend_rows.append([as_dt(stamp), lmd_total, sp_total, avg_rating, len(known)])
    dash["A8"] = "Historical Performance Trend"
    dash["A8"].font = Font(bold=True, size=14, color=NAVY)
    trend_headers = ["Captured At", "LMD Solves (known state)", "SudokuPad Solves (known state)", "Average Rating %", "Puzzles With History"]
    for col, h in enumerate(trend_headers, 1):
        dash.cell(9, col, h).font = Font(bold=True, color=WHITE)
        dash.cell(9, col).fill = PatternFill("solid", fgColor=BLUE)
    for ri, row in enumerate(trend_rows, 10):
        for ci, val in enumerate(row, 1):
            dash.cell(ri, ci, val)
        dash.cell(ri, 1).number_format = "yyyy-mm-dd hh:mm"
    if trend_rows:
        line = LineChart()
        line.title = "Recorded solve totals over time"
        line.y_axis.title = "Solves"
        line.x_axis.title = "Capture time"
        line.height, line.width = 8, 16
        line.add_data(Reference(dash, min_col=2, max_col=3, min_row=9, max_row=9 + len(trend_rows)), titles_from_data=True)
        line.set_categories(Reference(dash, min_col=1, min_row=10, max_row=9 + len(trend_rows)))
        line.style = 13
        dash.add_chart(line, "F8")

    # Top puzzles by current combined solves.
    top = sorted(active, key=lambda p: (p.get("lmd_solves") or 0) + (p.get("sudokupad_solves") or 0), reverse=True)[:12]
    top_start = max(12, 10 + len(trend_rows) + 2)
    dash.cell(top_start, 1, "Top Puzzles by Combined Solve Count").font = Font(bold=True, size=14, color=NAVY)
    dash.cell(top_start + 1, 1, "Puzzle").font = Font(bold=True, color=WHITE)
    dash.cell(top_start + 1, 2, "Combined solves").font = Font(bold=True, color=WHITE)
    for c in (1, 2):
        dash.cell(top_start + 1, c).fill = PatternFill("solid", fgColor=BLUE)
    for i, p in enumerate(top, top_start + 2):
        dash.cell(i, 1, p.get("title"))
        dash.cell(i, 2, (p.get("lmd_solves") or 0) + (p.get("sudokupad_solves") or 0))
    if top:
        bar = BarChart()
        bar.type = "bar"
        bar.style = 10
        bar.title = "Top 12 puzzles"
        bar.x_axis.title = "Combined solves"
        bar.y_axis.title = "Puzzle"
        bar.height, bar.width = 9, 16
        bar.add_data(Reference(dash, min_col=2, min_row=top_start + 1, max_row=top_start + 1 + len(top)), titles_from_data=True)
        bar.set_categories(Reference(dash, min_col=1, min_row=top_start + 2, max_row=top_start + 1 + len(top)))
        dash.add_chart(bar, "F25")

    for col in range(1, 13):
        dash.column_dimensions[get_column_letter(col)].width = 18
    dash.column_dimensions["A"].width = 34
    dash.freeze_panes = "A4"

    build_power_bi(wb, active, puzzles, snapshots, trend_rows)

    # Full current-state table.
    puzzle_fields = ["lmd_code", "puzzle_id", "puzzle_num", "title", "published_at",
                     "published_date_raw", "difficulty_stars", "author_rated", "sudokupad_url",
                     "lmd_solves", "sudokupad_solves", "rating_percent", "image_path",
                     "source_updated_at", "last_seen_at", "is_active"]
    puzzle_headers = puzzle_fields
    puzzle_rows = []
    for p in sorted(puzzles, key=lambda x: (x.get("puzzle_num") or 0), reverse=True):
        puzzle_rows.append([as_dt(p.get(f)) if f in ("published_at", "source_updated_at", "last_seen_at") else p.get(f) for f in puzzle_fields])
    ws = wb.create_sheet("Puzzle Master Data")
    write_table(ws, "Puzzle Master Data", puzzle_headers, puzzle_rows, "PuzzleMasterData",
                {"title": 38, "sudokupad_url": 48, "image_path": 28, "published_date_raw": 28})
    for row in range(5, 5 + len(puzzle_rows)):
        for col in (5, 14, 15):
            ws.cell(row, col).number_format = "yyyy-mm-dd hh:mm"

    # Every historical snapshot, enriched with puzzle metadata.
    snap_fields = ["id", "lmd_code", "captured_at", "lmd_solves", "sudokupad_solves", "rating_percent", "difficulty_stars"]
    snap_headers = snap_fields + ["puzzle_title", "puzzle_num", "published_at"]
    snap_rows = []
    for s in snapshots:
        p = puzzle_by_code.get(s.get("lmd_code"), {})
        snap_rows.append([s.get(f) if f != "captured_at" else as_dt(s.get(f)) for f in snap_fields] +
                         [p.get("title"), p.get("puzzle_num"), as_dt(p.get("published_at"))])
    ws = wb.create_sheet("Observation Log")
    write_table(ws, "Historical Observation Log", snap_headers, snap_rows, "ObservationLog",
                {"puzzle_title": 38})
    for row in range(5, 5 + len(snap_rows)):
        ws.cell(row, 3).number_format = "yyyy-mm-dd hh:mm:ss"
        ws.cell(row, 10).number_format = "yyyy-mm-dd"

    # Chronological per-puzzle deltas, preserving the raw snapshot values.
    grouped = defaultdict(list)
    for s in snapshots:
        grouped[s.get("lmd_code")].append(s)
    delta_rows = []
    for code, series in grouped.items():
        series.sort(key=lambda x: (x.get("captured_at") or "", x.get("id") or 0))
        previous = None
        p = puzzle_by_code.get(code, {})
        for s in series:
            lmd = s.get("lmd_solves")
            sp = s.get("sudokupad_solves")
            delta_rows.append([
                code, p.get("title"), as_dt(s.get("captured_at")), lmd, sp,
                s.get("rating_percent"), s.get("difficulty_stars"),
                None if previous is None or lmd is None or previous.get("lmd_solves") is None else lmd - previous["lmd_solves"],
                None if previous is None or sp is None or previous.get("sudokupad_solves") is None else sp - previous["sudokupad_solves"],
                None if previous is None else (lmd or 0) + (sp or 0) - (previous.get("lmd_solves") or 0) - (previous.get("sudokupad_solves") or 0)
            ])
            previous = s
    delta_rows.sort(key=lambda x: (x[0] or "", x[2] or datetime.min))
    ws = wb.create_sheet("Derived Metrics")
    write_table(ws, "Per-Puzzle Derived Metrics & Period-over-Period Changes", [
        "lmd_code", "title", "captured_at", "lmd_solves", "sudokupad_solves",
        "rating_percent", "difficulty_stars", "lmd_delta", "sudokupad_delta", "combined_delta"
    ], delta_rows, "PuzzleTrends", {"title": 38})
    for row in range(5, 5 + len(delta_rows)):
        ws.cell(row, 3).number_format = "yyyy-mm-dd hh:mm:ss"
    for col in (8, 9, 10):
        ws.conditional_formatting.add(f"{get_column_letter(col)}5:{get_column_letter(col)}{max(5, 4+len(delta_rows))}",
            DataBarRule(start_type="min", end_type="max", color=CYAN, showValue=True))

    # Workbook documentation, data dictionary and data-lineage diagram.
    ws = wb.create_sheet("Data Dictionary")
    style_title(ws, "Data Dictionary & Data Lineage", "Workbook structure, source definitions and analytical transformations", 8)

    # Data-flow diagram: source tables feed the master-data and observation sheets.
    diagram = [
        (4, 1, 8, "SUPABASE DATABASE  |  SOURCE TABLES", NAVY, WHITE),
        (6, 1, 4, "lmd_puzzles", BLUE, WHITE),
        (6, 5, 8, "lmd_puzzle_snapshots", BLUE, WHITE),
        (7, 1, 4, "Current puzzle attributes and latest metrics", PALE, NAVY),
        (7, 5, 8, "Timestamped historical measurements", PALE, NAVY),
        (9, 1, 4, "↓  Puzzle Master Data", "DCEAF5", NAVY),
        (9, 5, 8, "↓  Historical Observation Log", "DCEAF5", NAVY),
        (11, 1, 4, "Current-state records\nOne row per puzzle", LIGHT, NAVY),
        (11, 5, 8, "Historical records\nOne row per captured observation", LIGHT, NAVY),
        (13, 1, 4, "↓  Dashboard inputs", "DCEAF5", NAVY),
        (13, 5, 8, "↓  Derived Metrics", "FCEBD2", NAVY),
        (15, 1, 4, "KPIs and current top-puzzle ranking", LIGHT, NAVY),
        (15, 5, 8, "Per-puzzle changes between consecutive observations", LIGHT, NAVY),
        (17, 1, 8, "↓  Analytics Dashboard", GREEN, WHITE),
        (18, 1, 8, "KPIs and top-puzzle ranking use current master data. Historical charts reconstruct the latest-known state from the observation log.", "E4F2ED", NAVY),
    ]
    for row, start_col, end_col, value, fill, color in diagram:
        ws.merge_cells(start_row=row, start_column=start_col, end_row=row, end_column=end_col)
        cell = ws.cell(row, start_col, value)
        cell.fill = PatternFill("solid", fgColor=fill)
        cell.font = Font(bold=True, color=color, size=11 if row in (4, 17) else 10)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        for col in range(start_col, end_col + 1):
            ws.cell(row, col).fill = PatternFill("solid", fgColor=fill)
    for row, height in {4:26, 6:24, 7:34, 9:26, 11:42, 13:26, 15:36, 17:28, 18:42}.items():
        ws.row_dimensions[row].height = height
    ws.merge_cells("A20:H20")
    ws["A20"] = "Note: Derived Metrics is calculated from the Observation Log. The Analytics Dashboard uses Master Data and Observation Log directly; it does not depend on Derived Metrics."
    ws["A20"].font = Font(italic=True, color=GREY, size=9)
    ws["A20"].alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[20].height = 34

    # Side-by-side READ ME text guide. Keep the existing visual lineage diagram
    # on the left and restore the earlier explanatory narrative on the right.
    ws.merge_cells("J4:N4")
    ws["J4"] = "READ ME | TEXT GUIDE"
    ws["J4"].font = Font(bold=True, size=13, color=WHITE)
    ws["J4"].fill = PatternFill("solid", fgColor=NAVY)
    ws["J4"].alignment = Alignment(horizontal="center", vertical="center")
    for col in range(10, 15):
        ws.cell(4, col).fill = PatternFill("solid", fgColor=NAVY)
    readme_blocks = [
        (6, "WORKBOOK FLOW", "Supabase Database → Puzzle Catalog → Snapshot History → Puzzle Trends, with an Executive Dashboard bringing the analysis together."),
        (9, "1. CURRENT PUZZLE DATA", "The lmd_puzzles table stores the current record for each puzzle. It feeds Puzzle Master Data, which contains one row per puzzle and its latest known attributes and metrics."),
        (12, "2. HISTORICAL SNAPSHOTS", "The lmd_puzzle_snapshots table stores timestamped observations. It feeds the Observation Log, preserving the measurements captured over time."),
        (15, "3. PUZZLE TRENDS", "Derived Metrics is calculated from consecutive observations in the Observation Log. It shows how solve counts and other tracked values changed between saved snapshots."),
        (18, "4. EXECUTIVE DASHBOARD", "Analytics Dashboard combines current puzzle data with historical observations. Its historical chart reconstructs the latest-known state after each snapshot event; it does not depend on Derived Metrics."),
    ]
    for row, heading, body in readme_blocks:
        ws.merge_cells(start_row=row, start_column=10, end_row=row, end_column=14)
        h = ws.cell(row, 10, heading)
        h.font = Font(bold=True, size=10, color=WHITE)
        h.fill = PatternFill("solid", fgColor=BLUE)
        h.alignment = Alignment(vertical="center", wrap_text=True)
        for col in range(10, 15):
            ws.cell(row, col).fill = PatternFill("solid", fgColor=BLUE)
        ws.merge_cells(start_row=row + 1, start_column=10, end_row=row + 1, end_column=14)
        b = ws.cell(row + 1, 10, body)
        b.font = Font(size=10, color=NAVY)
        b.fill = PatternFill("solid", fgColor=LIGHT)
        b.alignment = Alignment(vertical="center", wrap_text=True)
        for col in range(10, 15):
            ws.cell(row + 1, col).fill = PatternFill("solid", fgColor=LIGHT)
        ws.row_dimensions[row].height = 22
        ws.row_dimensions[row + 1].height = 42
    ws.merge_cells("J20:N20")
    ws["J20"] = "Terminology note: the earlier labels Puzzle Catalog, Snapshot History, Puzzle Trends and Executive Dashboard are retained here as a conceptual reading guide. The actual worksheet names are shown in the diagram on the left."
    ws["J20"].font = Font(italic=True, size=9, color=GREY)
    ws["J20"].alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[20].height = 42

    # Data dictionary and workbook metadata.
    notes = [
        ["Workbook", "iEtsh LMD Analytics"],
        ["Source tables", "Supabase public.lmd_puzzles and public.lmd_puzzle_snapshots. Accessed server-side by GitHub Actions."],
        ["Analytics Dashboard", "Aggregated KPIs, current top-puzzle ranking and reconstructed historical solve totals."],
        ["Puzzle Master Data", "One row per puzzle, containing its current/latest attributes and metrics."],
        ["Observation Log", "All historical snapshots returned by Supabase, with timestamp and measured values."],
        ["Derived Metrics", "Per-puzzle differences between each observation and its immediately preceding saved observation."],
        ["Data Dictionary", "Definitions, source provenance, data lineage and interpretation notes for this workbook."],
        ["Snapshot capture", "The sync process records a snapshot when tracked metrics change; it does not necessarily create a row on every scheduled run."],
        ["Historical chart method", "At each snapshot event, the chart reconstructs the latest-known values for every puzzle with at least one observation."],
        ["Historical limitation", "Puzzles without a saved observation are excluded from reconstructed historical totals until their first observation."],
        ["Delta limitation", "The first observation for each puzzle has no previous observation, so its delta fields are blank."],
        ["Generated at (UTC)", now.isoformat()],
        ["Puzzle records", len(puzzles)],
        ["Observation records", len(snapshots)],
    ]
    ws.merge_cells("A22:B22")
    ws["A22"] = "DATA DICTIONARY & WORKBOOK GUIDE"
    ws["A22"].font = Font(bold=True, size=13, color=WHITE)
    ws["A22"].fill = PatternFill("solid", fgColor=NAVY)
    ws.row_dimensions[22].height = 28
    for i, (k, v) in enumerate(notes, 23):
        ws.cell(i, 1, k).font = Font(bold=True, color=NAVY)
        ws.cell(i, 1).fill = PatternFill("solid", fgColor=PALE)
        ws.cell(i, 2, v).alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[i].height = 32 if len(str(v)) > 90 else 22
    ws.column_dimensions["A"].width = 25
    ws.column_dimensions["B"].width = 110
    for col in "CDEFGH":
        ws.column_dimensions[col].width = 16
    for col in "JKLMN":
        ws.column_dimensions[col].width = 18
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "A23"

    # Consistent workbook metadata and print setup.
    wb.properties.title = "iEtsh LMD Analytics"
    wb.properties.subject = "Complete LMD puzzle catalog and historical Supabase analytics"
    wb.properties.creator = "iEtsh"
    for sheet in wb.worksheets:
        sheet.sheet_properties.pageSetUpPr.fitToPage = True
        sheet.page_setup.fitToWidth = 1
        sheet.page_setup.fitToHeight = 0
        sheet.sheet_view.zoomScale = 90
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUTPUT)
    print(f"Created {OUTPUT} | puzzles={len(puzzles)} | snapshots={len(snapshots)} | bytes={OUTPUT.stat().st_size}")


if __name__ == "__main__":
    main()
