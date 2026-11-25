# iEtsh.sudoku

A small project that started as a place to collect my Sudoku puzzles and gradually grew into something more: a puzzle archive, an automated data tracker, and a space to explore how people interact with the puzzles I create.

The site brings my published puzzles together in one place, with links to play them, a couple of ways to browse the archive, and a dashboard for looking at their activity over time.

**Live site:** https://ietsh.github.io/iEtsh/iEtsh.sudoku/

## What you'll find here

- **Puzzle archive** — A searchable-style archive presented in both table and gallery views, with puzzle details and direct links to play.
- **Latest puzzle and random pick** — Quick access to the newest addition or a puzzle chosen from the archive.
- **Live puzzle data** — Publication details, ratings, solve counts, and puzzle images collected from my [Logic Masters Germany profile](https://logic-masters.de/Raetselportal/Benutzer/eingestellt.php?name=iEtsh).
- **Analytics** — A separate area for exploring puzzle activity and exported data, including the Excel analytics workbook.
- **Community features** — A place for visitors to leave feedback and interact with the archive.

## How the data is updated

I wanted the archive to stay up to date without having to maintain every puzzle entry by hand.

A Python scraper reads the puzzle pages on Logic Masters Germany, extracts the available information, and downloads puzzle images. The collected data is stored in `config.json`, while update events are tracked separately.

GitHub Actions runs the update workflow. After the puzzle data is refreshed, the workflow also syncs the data to Supabase and generates the Excel workbooks used by the analytics area.

In short, the update flow looks like this:

```text
Logic Masters Germany
        |
        v
   Python scraper
        |
        v
 config.json + images
        |
        v
   GitHub Actions
        |
        +------> Update log
        |
        +------> Supabase
        |           |
        |           v
        |      Analytics data
        |
        +------> Excel exports
```

## Built with

- **HTML, CSS and JavaScript** for the website and its interactive archive.
- **D3.js** for data-driven visual elements.
- **Python** for scraping, processing, syncing, and exporting data.
- **GitHub Actions** for automating the update workflow.
- **Supabase** for storing and working with community and puzzle data.
- **Excel** for the generated analytics workbooks.

## Repository layout

```text
.
├── .github/
│   └── workflows/
│       └── update.yml
├── lib/
│   ├── base.css
│   ├── common.js
│   ├── d3-v7.8.4.js
│   └── logo.js
└── sudoku-ietsh/
    └── ietsh/
        └── lmd/
            ├── index.html
            ├── lmd.css
            ├── lmd.js
            ├── scraper.py
            ├── config.json
            ├── update-log.json
            ├── images/
            └── exports/
```

The repository also contains the supporting scripts and pages for data synchronization, analytics, and workbook generation.

## Running it locally

The archive itself is a static website, so you can serve the repository with any simple local HTTP server. For example, from the repository root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/sudoku-ietsh/ietsh/lmd/
```

Some parts of the project depend on external services or generated data. The automated scraper and data-sync workflow also need their Python dependencies and the relevant Supabase credentials configured in the GitHub repository.

## A note about the project

This is a personal project, built alongside my interest in Sudoku and software development. I use it to publish my puzzles, experiment with different ways of presenting puzzle data, and learn from the activity around each release.

I'm still improving it as I go.