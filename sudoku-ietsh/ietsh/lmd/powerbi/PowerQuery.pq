// iEtsh LMD Analytics — Power Query snippets
// In Power BI Desktop, create three Blank Queries. Rename them exactly as
// shown and paste the matching let...in expression into Advanced Editor.
// The source is the existing automatically refreshed public Excel export.
// No Supabase service-role key is embedded in this project.


// QUERY 1 — PuzzleMasterData
let
    Source = Excel.Workbook(
        Web.Contents("https://raw.githubusercontent.com/iEtsh/iEtsh.sudoku/main/sudoku-ietsh/ietsh/lmd/exports/iEtsh_LMD_Analytics.xlsx"),
        null,
        true
    ),
    Data = Source{[Item="PuzzleMasterData", Kind="Table"]}[Data],
    Typed = Table.TransformColumnTypes(Data, {
        {"lmd_code", type text},
        {"puzzle_id", type text},
        {"puzzle_num", Int64.Type},
        {"title", type text},
        {"published_at", type datetime},
        {"published_date_raw", type text},
        {"difficulty_stars", type number},
        {"author_rated", type logical},
        {"sudokupad_url", type text},
        {"lmd_solves", Int64.Type},
        {"sudokupad_solves", Int64.Type},
        {"rating_percent", type number},
        {"image_path", type text},
        {"source_updated_at", type datetime},
        {"last_seen_at", type datetime},
        {"is_active", type logical}
    })
in
    Typed


// QUERY 2 — ObservationLog
let
    Source = Excel.Workbook(
        Web.Contents("https://raw.githubusercontent.com/iEtsh/iEtsh.sudoku/main/sudoku-ietsh/ietsh/lmd/exports/iEtsh_LMD_Analytics.xlsx"),
        null,
        true
    ),
    Data = Source{[Item="ObservationLog", Kind="Table"]}[Data],
    Typed = Table.TransformColumnTypes(Data, {
        {"id", Int64.Type},
        {"lmd_code", type text},
        {"captured_at", type datetime},
        {"lmd_solves", Int64.Type},
        {"sudokupad_solves", Int64.Type},
        {"rating_percent", type number},
        {"difficulty_stars", type number},
        {"puzzle_title", type text},
        {"puzzle_num", Int64.Type},
        {"published_at", type datetime}
    }),
    AddSnapshotDate = Table.AddColumn(Typed, "Snapshot Date", each Date.From([captured_at]), type date)
in
    AddSnapshotDate


// QUERY 3 — PuzzleTrends
let
    Source = Excel.Workbook(
        Web.Contents("https://raw.githubusercontent.com/iEtsh/iEtsh.sudoku/main/sudoku-ietsh/ietsh/lmd/exports/iEtsh_LMD_Analytics.xlsx"),
        null,
        true
    ),
    Data = Source{[Item="PuzzleTrends", Kind="Table"]}[Data],
    Typed = Table.TransformColumnTypes(Data, {
        {"lmd_code", type text},
        {"title", type text},
        {"captured_at", type datetime},
        {"lmd_solves", Int64.Type},
        {"sudokupad_solves", Int64.Type},
        {"rating_percent", type number},
        {"difficulty_stars", type number},
        {"lmd_delta", Int64.Type},
        {"sudokupad_delta", Int64.Type},
        {"combined_delta", Int64.Type}
    })
in
    Typed
