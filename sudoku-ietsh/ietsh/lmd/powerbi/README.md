# iEtsh LMD Analytics — Power BI

## Ready-to-open Power BI project

The complete Power BI Desktop project is in this folder:

- `iEtsh_LMD_Analytics.pbip`
- `iEtsh_LMD_Analytics.Report/` — four report pages and their visuals
- `iEtsh_LMD_Analytics.SemanticModel/` — Power Query partitions, relationships, date table, and DAX measures

Open `iEtsh_LMD_Analytics.pbip` with Power BI Desktop. On first open, Power BI may ask you to sign in or choose **Anonymous** credentials for the public GitHub workbook source. Select **Anonymous** and allow the data to refresh.

## Report pages

1. **Overview** — KPI cards, historical LMD/SudokuPad solve trends, combined puzzle performance, and active-status distribution.
2. **Puzzle Performance** — separate LMD and SudokuPad solve comparisons and a puzzle detail table.
3. **Growth & History** — reconstructed historical platform totals and daily solve changes.
4. **Data Quality** — rating/difficulty coverage, snapshot count, and puzzle data table.

## Data source

The model imports the existing automatically refreshed workbook:

`https://raw.githubusercontent.com/iEtsh/iEtsh.sudoku/main/sudoku-ietsh/ietsh/lmd/exports/iEtsh_LMD_Analytics.xlsx`

The workbook is generated from the existing Supabase-backed update workflow. No private keys are included in this project.

## Publishing to the website

The PBIP source project is not itself an embeddable Power BI report. To display this exact report on the website, open it in Power BI Desktop, publish it to your Power BI workspace, then create a **Publish to web** embed link (only for data you are comfortable making public). The website can then embed that URL. The existing website password gate only hides the iframe UI; it does not make a public Power BI link private.

## Model details

Relationships:
- `PuzzleMasterData[lmd_code]` 1 → * `ObservationLog[lmd_code]`
- `PuzzleMasterData[lmd_code]` 1 → * `PuzzleTrends[lmd_code]`
- `Date[Date]` 1 → * `ObservationLog[Snapshot Date]`
- `Date[Date]` 1 → * `PuzzleTrends[Snapshot Date]`

Historical measures reconstruct the latest recorded solve total per puzzle as of the selected date; they do not sum all snapshots together. Daily change visuals use the per-puzzle deltas in `PuzzleTrends`, grouped by snapshot date. Historical data begins when each puzzle first has a saved observation.
