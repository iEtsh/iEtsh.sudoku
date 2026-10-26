(() => {
  const confPath = './config.json';

  const cache = {
    titles: {},
    images: {},
    hovered: null,
    data: null,
    state: null
  };

  const recent = d3.select('#most-recent');
  const summs = d3.select('#summary-table');
  const tooltip = d3.select('#tooltip');

  const tooltipImage = tooltip.select('.thumb img');

  let lastCheckRaw = null;
  let lastCheckTime = null;

  // ---------------------------------------------------------
  // Archive UI state   
  // ---------------------------------------------------------

  const archiveState = {
    search: '',
    sortKey: 'date',
    sortDirection: 'desc'
  };

  let archiveMode = 'table';
  let gallerySelectedPuzzle = null;

  const setArchiveMode = mode => {
    archiveMode = mode === 'gallery' ? 'gallery' : 'table';
    document.body.classList.toggle('gallery-mode-active', archiveMode === 'gallery');
    d3.selectAll('.archive-view-button')
      .classed('is-active', function () {
        return this.dataset.view === archiveMode;
      })
      .attr('aria-pressed', function () {
        return String(this.dataset.view === archiveMode);
      });
    renderArchive(false, true);
  };

  d3.selectAll('.archive-view-button').on('click', function () {
    setArchiveMode(this.dataset.view);
  });

  const clearUndoPassword = '1907';

  // ---------------------------------------------------------
  // Update monitor
  // ---------------------------------------------------------

  const updateLogPath =
    './update-log.json';

  const updateClearKey =
    'ietsh-lmd-update-cleared-at';

  const updateUndoKey =
    'ietsh-lmd-update-clear-undo-at';

  let updateLog = [];
  let updateClearAt = 0;
  let updateFilterType = 'ALL';

  const updateFilterTypes = [
    'ALL',
    'Puzzle Added',
    'Puzzle Removed',
    'Title Changed',
    'Date Changed',
    'Difficulty Changed',
    'Author Rating Changed',
    'SudokuPad Link Changed',
    'LMD Link Changed',
    'LMD Solvers Changed',
    'SudokuPad Solvers Changed',
    'Rating Changed',
    'Puzzle Settings Changed',
    'Puzzle Image Changed'
  ];

  const loadUpdateClearAt = () => {
    try {
      updateClearAt =
        Number(
          localStorage.getItem(
            updateClearKey
          )
        ) || 0;
    } catch (error) {
      updateClearAt = 0;
    }
  };

  const fetchUpdateLog = async () => {
    try {
      const response =
        await fetch(updateLogPath, { cache: 'no-cache' });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const previousIds =
        new Set(
          updateLog.map(
            entry => entry.id
          )
        );

      updateLog =
        Array.isArray(data)
          ? data
              .filter(
                entry => {
                  const time =
                    new Date(
                      entry.time
                    ).getTime();

                  return (
                    Number.isNaN(time) ||
                    time > updateClearAt
                  );
                }
              )
              .sort(
                (a, b) =>
                  new Date(b.time) -
                  new Date(a.time)
              )
          : [];

      updateClearButton();

      return updateLog
        .filter(
          entry =>
            !previousIds.has(
              entry.id
            )
        )
        .map(
          entry => entry.id
        );

    } catch (error) {
      console.warn(
        'Unable to load update log:',
        error
      );

      return [];
    }
  };

  const updateClearButton = () => {
    const button =
      d3.select(
        '.archive-clear-updates'
      );

    if (button.empty()) {
      return;
    }

    button
      .property(
        'disabled',
        !updateLog.length
      );
  };

  const updateUndoButton = () => {
    const button =
      d3.select(
        '.archive-undo-updates'
      );

    if (button.empty()) {
      return;
    }

    let hasUndo = false;

    try {
      hasUndo =
        localStorage.getItem(
          updateUndoKey
        ) !== null;
    } catch (error) {
      hasUndo = false;
    }

    button
      .property(
        'disabled',
        !hasUndo ||
        !isClearUndoPasswordValid()
      );
  };

  const clearUpdateLog = () => {
    if (!isClearUndoPasswordValid()) {
      updateClearUndoButtons();
      return;
    }

    const previousClearAt =
      updateClearAt;

    updateClearAt =
      Date.now();

    try {
      localStorage.setItem(
        updateUndoKey,
        String(previousClearAt)
      );

      localStorage.setItem(
        updateClearKey,
        String(updateClearAt)
      );
    } catch (error) {
      console.warn(
        'Unable to save update monitor state:',
        error
      );
    }

    updateLog = [];

    renderUpdateMonitor();
    updateClearButton();
    updateUndoButton();
  };

  const undoClearUpdateLog = () => {
    if (!isClearUndoPasswordValid()) {
      updateClearUndoButtons();
      return;
    }

    let previousClearAt = 0;
    let hasUndo = false;

    try {
      hasUndo =
        localStorage.getItem(
          updateUndoKey
        ) !== null;

      previousClearAt =
        Number(
          localStorage.getItem(
            updateUndoKey
          )
        ) || 0;
    } catch (error) {
      hasUndo = false;
      previousClearAt = 0;
    }

    if (!hasUndo) {
      updateClearUndoButtons();
      return;
    }

    updateClearAt =
      previousClearAt;

    try {
      localStorage.setItem(
        updateClearKey,
        String(updateClearAt)
      );

      localStorage.removeItem(
        updateUndoKey
      );
    } catch (error) {
      console.warn(
        'Unable to restore update monitor state:',
        error
      );
    }

    updateUndoButton();
    updateClearButton();

    fetchUpdateLog().then(
      () => {
        renderUpdateMonitor();
        updateClearButton();
      }
    );
  };

  const formatUpdateTime = time => {
    const date =
      new Date(time);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    return date.toLocaleString(
      undefined,
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  };

  const renderUpdateMonitor = (
    newEntryIds = []
  ) => {
    const host =
      d3.select(
        '#updates-monitor-host'
      );

    if (
      host.empty()
    ) {
      return;
    }

    host.html('');

    const monitor =
      host
        .append('div')
        .attr(
          'class',
          'update-monitor'
        );

    const heading =
      monitor
        .append('div')
        .attr(
          'class',
          'update-monitor-heading'
        );

    heading
      .append('span')
      .attr(
        'class',
        'update-monitor-label'
      )
      .text('UPDATES');

    const filterWrap =
      heading
        .append('div')
        .attr(
          'class',
          'update-monitor-filter'
        );

    const filter =
      filterWrap
        .append('select')
        .attr(
          'class',
          'update-monitor-filter-select'
        )
        .attr(
          'aria-label',
          'Filter updates by type'
        );

    updateFilterTypes.forEach(
      type => {
        filter
          .append('option')
          .attr(
            'value',
            type
          )
          .text(
            type === 'ALL'
              ? 'ALL'
              : type
          );
      }
    );

    filter
      .property(
        'value',
        updateFilterType
      )
      .on(
        'change',
        function () {
          updateFilterType =
            this.value;

          renderUpdateMonitor();

          const newFilter =
            document.querySelector(
              '.update-monitor-filter-select'
            );

          if (newFilter) {
            requestAnimationFrame(() => {
              newFilter.focus();
            });
          }
        }
      );

    const visibleUpdates =
      updateLog.filter(
        entry =>
          updateFilterType === 'ALL' ||
          entry.type === updateFilterType
      );

    const list =
      monitor
        .append('div')
        .attr(
          'class',
          'update-monitor-list'
        );

    if (
      !visibleUpdates.length
    ) {
      list
        .append('div')
        .attr(
          'class',
          'update-monitor-empty'
        )
        .text(
          'No updates recorded yet.'
        );

      return;
    }

    visibleUpdates.forEach(
      entry => {
        const item =
          list
            .append('div')
            .attr(
              'class',
              newEntryIds.includes(
                entry.id
              )
                ? 'update-entry update-entry-new'
                : 'update-entry'
            );

        item
          .attr(
            'data-update-id',
            entry.id
          );

        const type =
          item
            .append('div')
            .attr(
              'class',
              'update-entry-type'
            )
            .text(
              entry.type
            );

        if (
          entry.puzzleNum !==
          undefined &&
          entry.puzzleNum !==
          null
        ) {
          type
            .append('span')
            .attr(
              'class',
              'update-entry-puzzle'
            )
            .text(
              '#' +
              entry.puzzleNum
            );
        }

        item
          .append('div')
          .attr(
            'class',
            'update-entry-title'
          )
          .text(
            entry.title ||
            'Puzzle'
          );

        item
          .append('div')
          .attr(
            'class',
            'update-entry-time'
          )
          .text(
            formatUpdateTime(
              entry.time
            )
          );

        if (
          entry.previous !== undefined &&
          entry.current !== undefined &&
          (
            entry.type === 'Title Changed' ||
            entry.type === 'Date Changed' ||
            entry.type === 'Difficulty Changed' ||
            entry.type === 'SudokuPad Link Changed' ||
            entry.type === 'LMD Link Changed' ||
            entry.type === 'LMD Solvers Changed' ||
            entry.type === 'SudokuPad Solvers Changed' ||
            entry.type === 'Rating Changed'
          )
        ) {
          const change = item.append('div')
            .attr('class', 'update-entry-change');

          const from = change.append('div')
            .attr('class', 'update-entry-side');

          from.append('span')
            .attr('class', 'update-entry-side-label')
            .text('FROM');

          from.append('div')
            .attr('class', 'update-entry-value previous')
            .text(String(entry.previous));

          change.append('div')
            .attr('class', 'update-entry-arrow')
            .attr('aria-hidden', 'true')
            .text('→');

          const to = change.append('div')
            .attr('class', 'update-entry-side');

          to.append('span')
            .attr('class', 'update-entry-side-label')
            .text('TO');

          to.append('div')
            .attr('class', 'update-entry-value current')
            .text(String(entry.current));
        } else if (
          entry.type === 'Author Rating Changed'
        ) {
          item.append('div')
            .attr('class', 'update-entry-note')
            .text(
              entry.current === false
                ? "Rating is now based on solvers' ratings."
                : "Rating is now based on the author's rating."
            );
        }
      }
    );
  };

  loadUpdateClearAt();

  // ---------------------------------------------------------
  // Star rendering
  // ---------------------------------------------------------

  const drawStars = (
    node,
    stars,
    authorRated = false,
    size
  ) => {
    const container = node
      .append('div')
      .attr(
        'class',
        authorRated
          ? 'puzzle-stars author-stars'
          : 'puzzle-stars'
      );

    _iEtsh_.logo.drawStarBar(
      container,
      stars,
      size
    );
  };

  // ---------------------------------------------------------
  // Consistent SVG action icons
  // ---------------------------------------------------------

  const appendActionIcon = (node, type) => {
    const svg = node.append('svg')
      .attr('class', `action-icon-svg action-icon-${type}`)
      .attr('viewBox', '0 0 24 24')
      .attr('width', 15)
      .attr('height', 15)
      .attr('aria-hidden', 'true')
      .attr('focusable', 'false');

    if (type === 'play') {
      svg.append('path')
        .attr('d', 'M8 5.5v13L18 12z')
        .attr('fill', 'currentColor');
    } else if (type === 'link') {
      svg.append('path')
        .attr('d', 'M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93l-1.72 1.71')
        .attr('fill', 'none')
        .attr('stroke', 'currentColor')
        .attr('stroke-width', 1.8)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');
      svg.append('path')
        .attr('d', 'M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.71-1.71')
        .attr('fill', 'none')
        .attr('stroke', 'currentColor')
        .attr('stroke-width', 1.8)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');
    }

    return svg;
  };

  // ---------------------------------------------------------
  // Action buttons
  // ---------------------------------------------------------

  const setLink = (
    node,
    url,
    qs
  ) => {
    if (!url) return;

    const link = node
      .append('a')
      .attr(
        'href',
        url + (qs || '')
      )
      .attr(
        'target',
        '_blank'
      )
      .attr(
        'rel',
        'noopener noreferrer'
      )
      .attr(
        'class',
        'archive-action play-action'
      )
      .attr(
        'title',
        'Play this puzzle'
      )
      .attr(
        'aria-label',
        'Play this puzzle'
      );

    appendActionIcon(link.append('span').attr('class', 'action-icon'), 'play');


  };

  const lmdLink = code =>
    `https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=${code}`;

  const setLmd = (
    node,
    code
  ) => {
    if (!code) return;

    const link = node
      .append('a')
      .attr(
        'href',
        lmdLink(code)
      )
      .attr(
        'target',
        '_blank'
      )
      .attr(
        'rel',
        'noopener noreferrer'
      )
      .attr(
        'class',
        'archive-action lmd-action'
      )
      .attr(
        'title',
        'View this puzzle on Logic Masters Germany'
      )
      .attr(
        'aria-label',
        'View this puzzle on Logic Masters Germany'
      );

    appendActionIcon(link.append('span').attr('class', 'action-icon'), 'link');


  };

  // ---------------------------------------------------------
  // Latest Puzzle
  // ---------------------------------------------------------

  const recentStats = (
    info,
    i
  ) => {
    const content = info
      .append('div')
      .attr(
        'class',
        'latest-content'
      );

    // -------------------------------------------------------
    // Top badge + small puzzle number
    // -------------------------------------------------------

    const top = content
      .append('div')
      .attr(
        'class',
        'latest-top'
      );

    top
      .append('span')
      .attr(
        'class',
        'latest-badge'
      )
      .text('LATEST PUZZLE');



    // -------------------------------------------------------
    // Title
    // -------------------------------------------------------

    content
      .append('h2')
      .attr(
        'class',
        'latest-title'
      )
      .text(i.title);

    // -------------------------------------------------------
    // Date
    // -------------------------------------------------------

    content
      .append('p')
      .attr(
        'class',
        'latest-date'
      )
      .text(i.date);

    // -------------------------------------------------------
    // Stars
    // -------------------------------------------------------

    drawStars(
      content,
      i.stars,
      i.author_rated === true,
      30
    );

    // -------------------------------------------------------
    // Meta
    // -------------------------------------------------------

    const meta = content
      .append('div')
      .attr(
        'class',
        'latest-meta'
      );

    const solves = meta
      .append('div')
      .attr(
        'class',
        'meta-pill'
      );

    solves
      .append('span')
      .text('SOLVED');

    solves
      .append('strong')
      .text(
        `${i.sudokupad_solves || 0}`
      );

    const rating = meta
      .append('div')
      .attr(
        'class',
        'meta-pill'
      );

    rating
      .append('span')
      .text('RATING');

    rating
      .append('strong')
      .text(
        i.rating || 'N/A'
      );

    // -------------------------------------------------------
    // Actions
    // -------------------------------------------------------

    const actions = content
      .append('div')
      .attr(
        'class',
        'latest-actions'
      );

    if (i.puzz) {
      const play = actions
        .append('a')
        .attr(
          'href',
          i.puzz + (i.qs || '')
        )
        .attr(
          'target',
          '_blank'
        )
        .attr(
          'rel',
          'noopener noreferrer'
        )
        .attr(
          'class',
          'action-btn play-btn'
        )
        .attr(
          'title',
          'Play this puzzle'
        )
        .attr(
          'aria-label',
          'Play this puzzle'
        );

      appendActionIcon(play.append('span').attr('class', 'action-icon'), 'play');

      play
        .append('span')
        .attr(
          'class',
          'action-label'
        )
        .text('PLAY');
    }

    if (i.lmd) {
      const lmd = actions
        .append('a')
        .attr(
          'href',
          lmdLink(i.lmd)
        )
        .attr(
          'target',
          '_blank'
        )
        .attr(
          'rel',
          'noopener noreferrer'
        )
        .attr(
          'class',
          'action-btn lmd-btn'
        )
        .attr(
          'title',
          'View this puzzle on Logic Masters Germany'
        )
        .attr(
          'aria-label',
          'View this puzzle on Logic Masters Germany'
        );

      appendActionIcon(lmd.append('span').attr('class', 'action-icon'), 'link');

      lmd
        .append('span')
        .attr(
          'class',
          'action-label'
        )
        .text('LMD');
    }

    // -------------------------------------------------------
    // Latest puzzle image
    // -------------------------------------------------------

    if (i.image) {
      const imageWrap = info
        .append('div')
        .attr(
          'class',
          'latest-image'
        );

      imageWrap
        .append('span')
        .attr(
          'class',
          'latest-number'
        )
        .text(`#${i.num}`);

      imageWrap
        .append('img')
        .attr(
          'src',
          i.image
        )
        .attr(
          'alt',
          i.title || 'Puzzle'
        )
        .attr('loading', 'eager')
        .attr('decoding', 'async');
    }
  };

  const genMostRecent = d => {
    const items = d.items || [];

    const i =
      items.reduce(
        (latest, puzzle) => {
          if (!latest) return puzzle;

          return puzzleDate(puzzle) >
            puzzleDate(latest)
            ? puzzle
            : latest;
        },
        null
      );

    if (!i) return;

    const card = recent
      .append('div')
      .attr(
        'class',
        'latest-card'
      );

    card
      .append('div')
      .attr(
        'class',
        'latest-glow'
      );

    card
      .append('div')
      .attr(
        'class',
        'latest-number-bg'
      )
      .text(`#${i.num}`);

    const inner = card
      .append('div')
      .attr(
        'class',
        'latest-inner'
      );

    const info = inner
      .append('div')
      .attr(
        'class',
        'latest-info'
      );

    recentStats(
      info,
      i
    );
  };

  // ---------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------

  const toNumber = value => {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value)
        ? value
        : null;
    }

    const cleaned =
      String(value)
        .replace('%', '')
        .replace(',', '.')
        .trim();

    const number =
      parseFloat(cleaned);

    return Number.isFinite(number)
      ? number
      : null;
  };

  const puzzleDate = puzzle => {
    if (!puzzle || !puzzle.date) {
      return 0;
    }

    // Stored dates use "DD. Month YYYY, HH:MM".
    // Parse explicitly so sorting works consistently on desktop and mobile.
    const match =
      String(puzzle.date)
        .trim()
        .match(
          /^(\d{1,2})\.\s+([A-Za-z]+)\s+(\d{4}),\s+(\d{1,2}):(\d{2})$/
        );

    if (!match) {
      return 0;
    }

    const months = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11
    };

    const day = Number(match[1]);
    const month = months[match[2].toLowerCase()];
    const year = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);

    if (
      month === undefined ||
      !Number.isInteger(day) ||
      !Number.isInteger(year) ||
      !Number.isInteger(hour) ||
      !Number.isInteger(minute)
    ) {
      return 0;
    }

    const date =
      new Date(
        year,
        month,
        day,
        hour,
        minute
      );

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day ||
      date.getHours() !== hour ||
      date.getMinutes() !== minute
    ) {
      return 0;
    }

    return date.getTime();
  };

  const puzzleRating = puzzle => {
    return toNumber(
      puzzle && puzzle.rating
    );
  };

  const puzzleSolves = puzzle => {
    const value =
      toNumber(
        puzzle && puzzle.solves
      );

    return value === null
      ? 0
      : value;
  };

  const puzzleDifficulty = puzzle => {
    const value =
      toNumber(
        puzzle && puzzle.stars
      );

    return value === null
      ? 0
      : value;
  };

  const compareText = (
    a,
    b
  ) => {
    return String(a || '')
      .localeCompare(
        String(b || ''),
        undefined,
        {
          sensitivity: 'base',
          numeric: true
        }
      );
  };

  // ---------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------

  const getSortValue = (
    puzzle,
    key
  ) => {
    switch (key) {
      case 'date':
        return puzzleDate(puzzle);

      case 'rating': {
        const rating =
          puzzleRating(puzzle);

        return rating === null
          ? -Infinity
          : rating;
      }

      case 'sudokupad_solves': {
        const value =
          Number(
            puzzle.sudokupad_solves
          );

        return Number.isFinite(value)
          ? value
          : -Infinity;
      }

      case 'solves':
        return puzzleSolves(puzzle);

      case 'difficulty':
        return puzzleDifficulty(puzzle);

      default:
        return 0;
    }
  };

  const sortPuzzles = items => {
    const result =
      [...(items || [])];

    const key =
      archiveState.sortKey;

    const direction =
      archiveState.sortDirection === 'asc'
        ? 1
        : -1;

    result.sort(
      (a, b) => {
        const av =
          getSortValue(a, key);

        const bv =
          getSortValue(b, key);

        if (
          typeof av === 'string' ||
          typeof bv === 'string'
        ) {
          return (
            compareText(av, bv) *
            direction
          );
        }

        if (av < bv) {
          return -1 * direction;
        }

        if (av > bv) {
          return 1 * direction;
        }

        const dateA =
          puzzleDate(a);

        const dateB =
          puzzleDate(b);

        if (dateA !== dateB) {
          return dateB - dateA;
        }

        return compareText(
          a.title,
          b.title
        );
      }
    );

    return result;
  };

  const toggleSort = key => {
    if (
      archiveState.sortKey === key
    ) {
      archiveState.sortDirection =
        archiveState.sortDirection === 'asc'
          ? 'desc'
          : 'asc';
    } else {
      archiveState.sortKey = key;
      archiveState.sortDirection = 'desc';
    }

    renderArchive(false, true);
  };

  // ---------------------------------------------------------
  // Search
  // ---------------------------------------------------------

  const filteredPuzzles = items => {
    const query =
      archiveState.search
        .trim()
        .toLocaleLowerCase();

    if (!query) {
      return [...(items || [])];
    }

    return (items || []).filter(
      puzzle =>
        String(
          puzzle.title || ''
        )
          .toLocaleLowerCase()
          .includes(query)
    );
  };

  const isClearUndoPasswordValid = () => {
    const input =
      d3.select(
        '.archive-password-input'
      );

    return (
      !input.empty() &&
      input.property('value') ===
        clearUndoPassword
    );
  };

  const updateClearUndoButtons = () => {
    const clearButton =
      d3.select(
        '.archive-clear-updates'
      );

    const undoButton =
      d3.select(
        '.archive-undo-updates'
      );

    const passwordValid =
      isClearUndoPasswordValid();

    if (!clearButton.empty()) {
      clearButton.property(
        'disabled',
        !updateLog.length ||
        !passwordValid
      );
    }

    if (!undoButton.empty()) {
      let hasUndo = false;

      try {
        hasUndo =
          localStorage.getItem(
            updateUndoKey
          ) !== null;
      } catch (error) {
        hasUndo = false;
      }

      undoButton.property(
        'disabled',
        !hasUndo ||
        !passwordValid
      );
    }
  };

  // ---------------------------------------------------------
  // Sort button
  // ---------------------------------------------------------

  const appendSortButton = (
    parent,
    label,
    key
  ) => {
    const active =
      archiveState.sortKey === key;

    const direction =
      archiveState.sortDirection;

    const button = parent
      .append('button')
      .attr(
        'type',
        'button'
      )
      .attr(
        'class',
        active
          ? 'archive-sort-button active'
          : 'archive-sort-button'
      )
      .attr(
        'aria-label',
        active
          ? `${label}, ${
              direction === 'asc'
                ? 'ascending'
                : 'descending'
            }. Click to reverse order.`
          : `Sort by ${label}`
      )
      .attr(
        'title',
        active
          ? `Currently ${
              direction === 'asc'
                ? 'ascending'
                : 'descending'
            }. Click to reverse.`
          : `Sort by ${label}`
      );

    button
      .append('span')
      .attr(
        'class',
        'archive-sort-label'
      )
      .text(label);

    button
      .append('span')
      .attr(
        'class',
        'archive-sort-arrow'
      )
      .text(
        active
          ? (
              direction === 'asc'
                ? '↑'
                : '↓'
            )
          : '↕'
      );

    button.on(
      'click',
      () => toggleSort(key)
    );
  };

  // ---------------------------------------------------------
  // Archive header
  // ---------------------------------------------------------

  const genSummaryHeader = () => {
    const header = summs
      .append('div')
      .attr(
        'class',
        'archive-header'
      );

    header
      .append('div')
      .attr(
        'class',
        'archive-header-number'
      );

    header
      .append('div')
      .attr(
        'class',
        'archive-header-title'
      );

    const dateHeader =
      header
        .append('div')
        .attr(
          'class',
          'archive-header-date'
        );

    appendSortButton(
      dateHeader,
      'DATE',
      'date'
    );

    const difficultyHeader =
      header
        .append('div')
        .attr(
          'class',
          'archive-header-difficulty'
        );

    appendSortButton(
      difficultyHeader,
      'DIFFICULTY',
      'difficulty'
    );

    header
      .append('div')
      .attr(
        'class',
        'archive-header-link'
      )
      .text('LMD');

    header
      .append('div')
      .attr(
        'class',
        'archive-header-link'
      )
      .text('PLAY');

    const sudokupadSolvesHeader =
      header
        .append('div')
        .attr(
          'class',
          'archive-header-sudokupad-solves'
        );

    appendSortButton(
      sudokupadSolvesHeader,
      'SOLVERS',
      'sudokupad_solves'
    );

    const solvesHeader =
      header
        .append('div')
        .attr(
          'class',
          'archive-header-solves'
        );

    appendSortButton(
      solvesHeader,
      'LMD SOLVERS',
      'solves'
    );

    const ratingHeader =
      header
        .append('div')
        .attr(
          'class',
          'archive-header-rating'
        );

    appendSortButton(
      ratingHeader,
      'RATING',
      'rating'
    );
  };

  // ---------------------------------------------------------
  // Search + archive controls
  // ---------------------------------------------------------

  const genArchiveControls = () => {
    const controls =
      summs
        .append('div')
        .attr(
          'class',
          'archive-controls'
        );

    const searchWrap =
      controls
        .append('div')
        .attr(
          'class',
          'archive-search'
        );

    searchWrap
      .append('span')
      .attr(
        'class',
        'archive-search-icon'
      )
      .text('⌕');

    const input =
      searchWrap
        .append('input')
        .attr(
          'type',
          'search'
        )
        .attr(
          'class',
          'archive-search-input'
        )
        .attr(
          'placeholder',
          'Search puzzle name...'
        )
        .attr(
          'aria-label',
          'Search puzzles by name'
        )
        .property(
          'value',
          archiveState.search
        );

    input.on(
      'input',
      function () {
        archiveState.search =
          this.value;

        renderArchive(true, true);
      }
    );

    input.on(
      'keydown',
      ev => {
        if (
          ev.key === 'ArrowDown'
        ) {
          ev.preventDefault();

          focusArchiveRow(0);

          return;
        }

        if (
          ev.key === 'Escape'
        ) {
          ev.preventDefault();

          archiveState.search = '';

          input.property(
            'value',
            ''
          );

          renderArchive(true, true);

        }
      }
    );

    const passwordWrap =
      controls
        .append('div')
        .attr(
          'class',
          'archive-password'
        );

    passwordWrap
      .append('input')
      .attr(
        'type',
        'password'
      )
      .attr(
        'class',
        'archive-password-input'
      )
      .attr(
        'placeholder',
        'Password'
      )
      .attr(
        'aria-label',
        'Password for CLEAR / UNDO'
      )
      .attr(
        'autocomplete',
        'off'
      );

    passwordWrap
      .select('input')
      .on(
        'input',
        () => {
          updateClearUndoButtons();
        }
      )
      .on(
        'keydown',
        ev => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            updateClearUndoButtons();
          }
        }
      );

    controls
      .append('button')
      .attr(
        'type',
        'button'
      )
      .attr(
        'class',
        'archive-clear-updates'
      )
      .attr(
        'title',
        'Clear update history'
      )
      .attr(
        'aria-label',
        'Clear update history'
      )
      .property(
        'disabled',
        !updateLog.length
      )
      .text('CLEAR UPDATES')
      .on(
        'click',
        clearUpdateLog
      );

    let hasUndo = false;

    try {
      hasUndo =
        localStorage.getItem(
          updateUndoKey
        ) !== null;
    } catch (error) {
      hasUndo = false;
    }

    controls
      .append('button')
      .attr(
        'type',
        'button'
      )
      .attr(
        'class',
        'archive-undo-updates'
      )
      .attr(
        'title',
        'Undo last clear'
      )
      .attr(
        'aria-label',
        'Undo last clear'
      )
      .property(
        'disabled',
        !hasUndo ||
        !isClearUndoPasswordValid()
      )
      .text('UNDO')
      .on(
        'click',
        undoClearUpdateLog
      );

    updateClearUndoButtons();
  };

  // ---------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------

  const calculateDashboard = items => {
    const puzzles =
      items || [];

    const totalPuzzles =
      puzzles.length;

    const totalSolves =
      puzzles.reduce(
        (sum, puzzle) => {
          const value =
            Number(
              puzzle.sudokupad_solves
            );

          return sum +
            (Number.isFinite(value)
              ? value
              : 0);
        },
        0
      );

    const ratings =
      puzzles
        .map(puzzle =>
          puzzleRating(puzzle)
        )
        .filter(
          value =>
            value !== null
        );

    const averageRating =
      ratings.length
        ? ratings.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / ratings.length
        : null;

    return {
      totalPuzzles,
      totalSolves,
      averageRating
    };
  };

  const formatAverageRating =
    value => {
      if (
        value === null ||
        !Number.isFinite(value)
      ) {
        return 'N/A';
      }

      return `${value.toFixed(1)}%`;
    };

  const formatNumber =
    value =>
      Number(
        value || 0
      ).toLocaleString();

  const genDashboard = d => {
    const dashboard =
      d3.select(
        '#puzzle-dashboard'
      );

    if (
      dashboard.empty()
    ) {
      return;
    }

    dashboard.html('');

    const stats =
      calculateDashboard(
        d.items || []
      );

    dashboard
      .append('div')
      .attr(
        'class',
        'dashboard-heading'
      )
      .append('div')
      .attr(
        'class',
        'dashboard-label'
      )
      .text('PUZZLE DASHBOARD');

    const cards =
      dashboard
        .append('div')
        .attr(
          'class',
          'dashboard-cards'
        );

    const addCard = (
      label,
      value,
      extraClass
    ) => {
      const card =
        cards
          .append('div')
          .attr(
            'class',
            `dashboard-card ${
              extraClass || ''
            }`
          );

      card
        .append('span')
        .attr(
          'class',
          'dashboard-card-label'
        )
        .text(label);

      card
        .append('strong')
        .attr(
          'class',
          'dashboard-card-value'
        )
        .text(value);
    };

    addCard(
      'TOTAL PUZZLES',
      formatNumber(
        stats.totalPuzzles
      ),
      'dashboard-puzzles'
    );

    addCard(
      'AVG RATING',
      formatAverageRating(
        stats.averageRating
      ),
      'dashboard-rating'
    );

    addCard(
      'TOTAL SOLVES',
      formatNumber(
        stats.totalSolves
      ),
      'dashboard-solves'
    );

    renderUpdateMonitor();
  };

  // ---------------------------------------------------------
  // Tooltip
  // ---------------------------------------------------------

  const hideTooltip = () => {
    tooltip
      .style(
        'opacity',
        0
      );

    if (
      cache.hovered
    ) {
      cache.hovered.style(
        'background-color',
        null
      );

      cache.hovered = null;
    }
  };

  const positionTooltip = (
    event
  ) => {
    const tooltipNode =
      tooltip.node();

    if (!tooltipNode) {
      return;
    }

    const rect =
      tooltipNode.getBoundingClientRect();

    const gap = 16;

    let left =
      event.clientX;

    let top =
      event.clientY - rect.height - gap;

    if (
      left - rect.width / 2 < 8
    ) {
      left =
        rect.width / 2 + 8;
    }

    if (
      left + rect.width / 2 >
      window.innerWidth - 8
    ) {
      left =
        window.innerWidth -
        rect.width / 2 -
        8;
    }

    if (top < 8) {
      top =
        event.clientY + gap;
    }

    if (
      top + rect.height >
      window.innerHeight - 8
    ) {
      top =
        Math.max(
          8,
          window.innerHeight -
            rect.height -
            8
        );
    }

    tooltip
      .style(
        'left',
        `${left}px`
      )
      .style(
        'top',
        `${top}px`
      )
      .style(
        'transform',
        'translateX(-50%)'
      );
  };

  const showTooltip = (
    id,
    title,
    event
  ) => {
    tooltip
      .select('.caption')
      .text(
        title || ''
      );

    const image =
      cache.images[id] || '';

    if (image) {
      tooltipImage
        .attr(
          'src',
          image
        )
        .attr(
          'alt',
          title || 'Puzzle'
        )
        .style(
          'display',
          'block'
        );
    } else {
      tooltipImage
        .attr(
          'src',
          ''
        )
        .attr(
          'alt',
          ''
        )
        .style(
          'display',
          'none'
        );
    }

    tooltip
      .style(
        'opacity',
        1
      );

    positionTooltip(event);
  };

  const handleRowMouseEnter = function (
    event
  ) {
    const row =
      d3.select(this);

    if (
      cache.hovered &&
      cache.hovered.node() !== this
    ) {
      cache.hovered.style(
        'background-color',
        null
      );
    }

    cache.hovered =
      row;

    row.style(
      'background-color',
      'rgba(255,255,255,0.04)'
    );

    const rowId =
      row.attr('id');

    if (!rowId) {
      hideTooltip();
      return;
    }

    const id =
      rowId.slice(3);

    showTooltip(
      id,
      cache.titles[id] || '',
      event
    );
  };

  const handleRowMouseMove = function (
    event
  ) {
    const row =
      d3.select(this);

    const rowId =
      row.attr('id');

    if (!rowId) {
      hideTooltip();
      return;
    }

    const id =
      rowId.slice(3);

    if (
      cache.hovered &&
      cache.hovered.node() === this
    ) {
      positionTooltip(event);
      return;
    }

    showTooltip(
      id,
      cache.titles[id] || '',
      event
    );
  };

  const handleRowMouseLeave = function () {
    hideTooltip();
  };

  // On touch screens, dismiss the row preview when tapping outside the table.
  d3.select('body').on(
    'click.archive-tooltip',
    function (event) {
      const target = event.target;

      if (
        target &&
        target.closest &&
        target.closest('#summary-table .rec')
      ) {
        return;
      }

      hideTooltip();
    }
  );

  // ---------------------------------------------------------
  // Archive row
  // ---------------------------------------------------------

  const createArchiveRow =
    puzzle => {
      const id =
        puzzle.id;

      const div = summs
        .append('div')
        .attr(
          'id',
          `st-${id}`
        )
        .attr(
          'class',
          'rec'
        )
        .attr(
          'tabindex',
          '0'
        )
        .attr(
          'role',
          'article'
        )
        .attr(
          'aria-label',
          `${puzzle.title || 'Puzzle'}`
        );

      div
        .on(
          'mouseenter',
          handleRowMouseEnter
        )
        .on(
          'mousemove',
          handleRowMouseMove
        )
        .on(
          'mouseleave',
          handleRowMouseLeave
        )
        .on(
          'click',
          function (event) {
            if (
              !window.matchMedia(
                '(max-width: 760px)'
              ).matches
            ) {
              return;
            }

            const target = event.target;

            if (
              target &&
              target.closest &&
              target.closest(
                'a, button, input, select, textarea'
              )
            ) {
              return;
            }

            const row = d3.select(this);
            const rowId = row.attr('id');

            if (!rowId) {
              hideTooltip();
              return;
            }

            const id = rowId.slice(3);

            cache.hovered = row;

            row.style(
              'background-color',
              'rgba(255,255,255,0.04)'
            );

            showTooltip(
              id,
              cache.titles[id] || '',
              event
            );
          }
        );

      const ul =
        div
          .append('ul');

      // -----------------------------------------------------
      // Number
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-number'
        )
        .text(
          `#${puzzle.num}`
        );

      // -----------------------------------------------------
      // Title
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-title'
        )
        .text(
          puzzle.title
        );

      cache.titles[id] =
        puzzle.title;

      cache.images[id] =
        puzzle.image || '';

      // -----------------------------------------------------
      // Date
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-date'
        )
        .text(
          puzzle.date
        );

      // -----------------------------------------------------
      // Difficulty
      // -----------------------------------------------------

      drawStars(
        ul.append('li'),
        puzzle.stars,
        puzzle.author_rated === true,
        window.matchMedia('(max-width: 760px)').matches ? 12 : undefined
      );

      ul
        .select('li:last-child')
        .attr(
          'class',
          'archive-difficulty'
        );

      // -----------------------------------------------------
      // LMD Link
      // -----------------------------------------------------

      const lmd =
        ul
          .append('li')
          .attr(
            'class',
            'archive-link'
          );

      setLmd(
        lmd,
        puzzle.lmd
      );

      // -----------------------------------------------------
      // Play
      // -----------------------------------------------------

      const play =
        ul
          .append('li')
          .attr(
            'class',
            'archive-link'
          );

      setLink(
        play,
        puzzle.puzz,
        puzzle.qs || ''
      );

      // -----------------------------------------------------
      // SudokuPad Solvers
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-sudokupad-solves'
        )
        .text(
          puzzle.sudokupad_solves === null ||
          puzzle.sudokupad_solves === undefined ||
          puzzle.sudokupad_solves === ''
            ? '0'
            : puzzle.sudokupad_solves
        );

      // -----------------------------------------------------
      // LMD Solvers
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-solves'
        )
        .text(
          puzzle.solves === null ||
          puzzle.solves === undefined ||
          puzzle.solves === ''
            ? '0'
            : puzzle.solves
        );

      // -----------------------------------------------------
      // Rating
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-rating'
        )
        .text(
          puzzle.rating === null ||
          puzzle.rating === undefined ||
          puzzle.rating === ''
            ? 'N/A'
            : puzzle.rating
        );

      return div;
    };

  // ---------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------

  const getVisibleRows = () => {
    return Array.from(
      document.querySelectorAll(
        '#summary-table .rec'
      )
    ).filter(
      row =>
        row.offsetParent !== null
    );
  };

  const focusArchiveRow = index => {
    const rows =
      getVisibleRows();

    if (!rows.length) {
      return;
    }

    const safeIndex =
      Math.max(
        0,
        Math.min(
          index,
          rows.length - 1
        )
      );

    rows[safeIndex]
      .focus({
        preventScroll: false
      });

    rows[safeIndex]
      .scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
  };

  const handleArchiveKeyboard =
    ev => {
      const target =
        ev.target;

      if (
        target &&
        (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT'
        )
      ) {
        return;
      }

      const row =
        target &&
        target.closest
          ? target.closest(
              '#summary-table .rec'
            )
          : null;

      if (!row) {
        return;
      }

      const rows =
        getVisibleRows();

      const currentIndex =
        rows.indexOf(row);

      if (
        ev.key === 'ArrowDown'
      ) {
        ev.preventDefault();

        focusArchiveRow(
          currentIndex + 1
        );

        return;
      }

      if (
        ev.key === 'ArrowUp'
      ) {
        ev.preventDefault();

        focusArchiveRow(
          currentIndex - 1
        );

        return;
      }

      if (
        ev.key === 'Home'
      ) {
        ev.preventDefault();

        focusArchiveRow(0);

        return;
      }

      if (
        ev.key === 'End'
      ) {
        ev.preventDefault();

        focusArchiveRow(
          rows.length - 1
        );
      }
    };

  document.addEventListener(
    'keydown',
    handleArchiveKeyboard
  );


  // ---------------------------------------------------------
  // Interactive gallery + data exploration
  // ---------------------------------------------------------

  const galleryNumber = value =>
    Number(value || 0).toLocaleString();

  const galleryRatingText = puzzle => {
    const value = puzzleRating(puzzle);
    return value === null ? 'N/A' : `${value}%`;
  };

  const renderGallery = puzzles => {
    const root = summs
      .append('section')
      .attr('class', 'living-gallery')
      .attr('aria-label', 'Interactive puzzle gallery');

    const ratings = puzzles
      .map(puzzleRating)
      .filter(value => value !== null);
    const averageRating = ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : null;
    const totalPadSolves = puzzles.reduce((sum, puzzle) => {
      const value = Number(puzzle.sudokupad_solves);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const totalLmdSolves = puzzles.reduce((sum, puzzle) => {
      const value = Number(puzzle.solves);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const metrics = root.append('div').attr('class', 'gallery-metrics');
    [
      { label: 'Puzzles shown', value: galleryNumber(puzzles.length), note: 'Current selection', tone: 'cyan' },
      { label: 'Average rating', value: averageRating === null ? 'N/A' : `${averageRating.toFixed(1)}%`, note: `${ratings.length} rated puzzles`, tone: 'violet' },
      { label: 'SudokuPad solves', value: galleryNumber(totalPadSolves), note: 'Across this selection', tone: 'blue' },
      { label: 'LMD solves', value: galleryNumber(totalLmdSolves), note: 'Across this selection', tone: 'amber' }
    ].forEach(metric => {
      const card = metrics.append('div')
        .attr('class', `gallery-metric gallery-metric-${metric.tone}`);
      card.append('span').attr('class', 'gallery-metric-label').text(metric.label);
      card.append('strong').attr('class', 'gallery-metric-value').text(metric.value);
      card.append('span').attr('class', 'gallery-metric-note').text(metric.note);
    });

    const analysis = root.append('div').attr('class', 'gallery-analysis');
    const chartPanel = analysis.append('section').attr('class', 'gallery-chart-panel');
    const chartHead = chartPanel.append('div').attr('class', 'gallery-panel-heading');
    const chartTitle = chartHead.append('div');
    chartTitle.append('h2').text('Most played puzzles');
    chartTitle.append('p').text('Select a bar to jump to that puzzle');
    chartHead.append('span').attr('class', 'gallery-chart-key').text('SUDOKUPAD SOLVES');

    const distribution = chartPanel.append('div').attr('class', 'gallery-distribution');
    const distributionHead = distribution.append('div').attr('class', 'gallery-distribution-heading');
    const distributionCopy = distributionHead.append('div');
    distributionCopy.append('span').attr('class', 'gallery-distribution-eyebrow').text('SOLVE DISTRIBUTION');
    distributionCopy.append('h3').text('How the collection gets played');
    distributionCopy.append('p').text('Each point is a puzzle. Hover to inspect it, or switch the data source.');
    const distributionSwitch = distributionHead.append('div')
      .attr('class', 'gallery-distribution-switch')
      .attr('role', 'group')
      .attr('aria-label', 'Choose solve distribution');
    const distributionModes = [
      { key: 'sudokupad_solves', label: 'SudokuPad', tone: 'pad' },
      { key: 'solves', label: 'LMD', tone: 'lmd' }
    ];
    distributionModes.forEach((mode, index) => {
      if (index === 1) distributionSwitch.append('span').attr('class', 'gallery-distribution-divider').attr('aria-hidden', 'true');
      distributionSwitch.append('button')
        .attr('type', 'button')
        .attr('class', `gallery-distribution-option distribution-option-${mode.tone}${index === 0 ? ' is-active' : ''}`)
        .attr('data-metric', mode.key)
        .attr('aria-pressed', String(index === 0))
        .text(mode.label)
        .on('click', function () {
          const metric = this.dataset.metric;
          distributionSwitch.selectAll('.gallery-distribution-option')
            .classed('is-active', function () { return this.dataset.metric === metric; })
            .attr('aria-pressed', function () { return String(this.dataset.metric === metric); });
          drawDistribution(metric, true);
          renderBars(metric, true);
          chartHead.select('.gallery-chart-key').text(metric === 'solves' ? 'LMD SOLVES' : 'SUDOKUPAD SOLVES');
        });
    });
    const distributionChartHost = distribution.append('div').attr('class', 'gallery-distribution-chart');
    const distributionSvg = distributionChartHost.append('svg')
      .attr('viewBox', '0 0 760 230')
      .attr('role', 'img')
      .attr('aria-label', 'Puzzle solve distribution curve');
    const distributionDefs = distributionSvg.append('defs');
    const distributionGradient = distributionDefs.append('linearGradient')
      .attr('id', 'puzzle-distribution-gradient').attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    distributionGradient.append('stop').attr('offset', '0%').attr('stop-color', '#67e8f9').attr('stop-opacity', .3);
    distributionGradient.append('stop').attr('offset', '100%').attr('stop-color', '#818cf8').attr('stop-opacity', .015);
    const distributionGrid = distributionSvg.append('g').attr('class', 'distribution-grid');
    const distributionArea = distributionSvg.append('path').attr('class', 'distribution-area');
    const distributionClip = distributionDefs.append('clipPath').attr('id', 'puzzle-distribution-area-clip');
    distributionClip.append('path');
    const distributionScan = distributionSvg.append('rect')
      .attr('class', 'distribution-scan')
      .attr('y', 10).attr('width', 110).attr('height', 190)
      .attr('fill', 'url(#puzzle-distribution-scan-gradient)')
      .attr('clip-path', 'url(#puzzle-distribution-area-clip)')
      .attr('pointer-events', 'none');
    const scanGradient = distributionDefs.append('linearGradient')
      .attr('id', 'puzzle-distribution-scan-gradient').attr('x1', '0').attr('x2', '1').attr('y1', '0').attr('y2', '0');
    scanGradient.append('stop').attr('offset', '0%').attr('stop-color', '#67e8f9').attr('stop-opacity', 0);
    scanGradient.append('stop').attr('offset', '45%').attr('stop-color', '#67e8f9').attr('stop-opacity', .02);
    scanGradient.append('stop').attr('offset', '72%').attr('stop-color', '#a5f3fc').attr('stop-opacity', .34);
    scanGradient.append('stop').attr('offset', '100%').attr('stop-color', '#67e8f9').attr('stop-opacity', 0);
    const distributionCurve = distributionSvg.append('path').attr('class', 'distribution-curve');
    const distributionPoints = distributionSvg.append('g').attr('class', 'distribution-points');
    const distributionAxis = distributionSvg.append('g').attr('class', 'distribution-axis');
    const distributionNote = distribution.append('div').attr('class', 'gallery-distribution-note');
    const distributionColors = d3.scaleOrdinal(d3.schemeTableau10);
    const distributionMotionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let distributionObserver = null;
    let distributionHasEntered = false;
    let distributionMetric = 'sudokupad_solves';

    const drawDistribution = (metric, animate) => {
      distributionMetric = metric;
      const sorted = [...puzzles].map((puzzle, index) => ({
        puzzle,
        index,
        value: Math.max(0, Number(puzzle[metric]) || 0)
      })).sort((a, b) => a.value - b.value);
      const width = 760, height = 230;
      const margin = { top: 14, right: 18, bottom: 32, left: 48 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;
      const maxValue = Math.max(1, ...sorted.map(point => point.value));
      const x = d3.scaleLinear().domain([0, Math.max(1, sorted.length - 1)]).range([margin.left, width - margin.right]);
      const y = d3.scaleLinear().domain([0, maxValue * 1.08]).nice(4).range([height - margin.bottom, margin.top]);
      const points = sorted.map((item, index) => ({ ...item, x: x(index), y: y(item.value) }));
      const line = d3.line().x(point => point.x).y(point => point.y).curve(d3.curveMonotoneX);
      const area = d3.area().x(point => point.x).y0(height - margin.bottom).y1(point => point.y).curve(d3.curveMonotoneX);

      distributionGrid.selectAll('*').remove();
      distributionGrid.selectAll('line').data(y.ticks(4)).join('line')
        .attr('x1', margin.left).attr('x2', width - margin.right)
        .attr('y1', tick => y(tick)).attr('y2', tick => y(tick));
      distributionGrid.selectAll('text').data(y.ticks(4)).join('text')
        .attr('x', margin.left - 9).attr('y', tick => y(tick) + 3)
        .attr('text-anchor', 'end').text(tick => galleryNumber(tick));
      distributionAxis.selectAll('*').remove();
      distributionAxis.append('text').attr('x', margin.left).attr('y', height - 7).text('LESS PLAYED');
      distributionAxis.append('text').attr('x', width - margin.right).attr('y', height - 7)
        .attr('text-anchor', 'end').text('MORE PLAYED');
      const areaPath = points.length > 1 ? area(points) : null;
      distributionArea.datum(points).attr('d', areaPath);
      distributionClip.select('path').attr('d', areaPath);
      distributionScan.attr('x', margin.left - 110).attr('height', height - margin.top - margin.bottom + 2);
      distributionCurve.datum(points).attr('d', points.length > 1 ? line : null);
      distributionPoints.selectAll('circle').data(points, point => point.puzzle.id)
        .join(
          enter => enter.append('circle').attr('r', 0).attr('cx', point => point.x).attr('cy', point => point.y),
          update => update,
          exit => exit.transition().duration(distributionMotionReduced ? 0 : 180).attr('r', 0).remove()
        )
        .attr('cx', point => point.x)
        .attr('cy', point => point.y)
        .attr('fill', point => distributionColors(point.puzzle.id || point.index))
        .attr('stroke', '#0c121e').attr('stroke-width', 2)
        .attr('tabindex', 0)
        .attr('aria-label', point => `${point.puzzle.title || 'Puzzle'}: ${galleryNumber(point.value)} ${metric === 'solves' ? 'LMD solves' : 'SudokuPad solves'}`)
        .on('pointerenter focus', function (event, point) {
          d3.select(this).attr('r', 6).attr('stroke', '#f8fafc');
          distributionNote.text(`${point.puzzle.title || 'Untitled puzzle'} · ${galleryNumber(point.value)} ${metric === 'solves' ? 'LMD solves' : 'SudokuPad solves'}`);
        })
        .on('pointerleave blur', function () {
          d3.select(this).attr('r', 3.5).attr('stroke', '#0c121e');
          distributionNote.text(`${sorted.length} puzzles · Sorted from fewer to more solves`);
        })
        .attr('r', animate && !distributionMotionReduced ? 0 : 3.5)
        .transition().duration(animate && !distributionMotionReduced ? 520 : 0)
        .delay((point, index) => animate && !distributionMotionReduced ? Math.min(index * 8, 360) : 0)
        .attr('r', 3.5);
      if (animate && !distributionMotionReduced && distributionHasEntered) {
        const path = distributionCurve.node();
        if (path) {
          const length = path.getTotalLength();
          distributionCurve.attr('stroke-dasharray', length).attr('stroke-dashoffset', length)
            .transition().duration(1050).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);
        }
        distributionArea.style('opacity', 0).transition().duration(900).style('opacity', 1);
      } else {
        distributionCurve.attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
        distributionArea.style('opacity', 1);
      }
      distributionNote.text(`${sorted.length} puzzles · Sorted from fewer to more solves`);
      distributionSvg.attr('aria-label', `${metric === 'solves' ? 'LMD' : 'SudokuPad'} solve distribution across ${sorted.length} puzzles`);
    };

    drawDistribution(distributionMetric, false);
    const runDistributionScan = () => {
      if (distributionMotionReduced || !distributionHasEntered) return;
      distributionScan.interrupt().attr('x', 0).attr('opacity', 0);
      const scanOnce = () => distributionScan
        .attr('x', 0).attr('opacity', 0)
        .transition().duration(2400).ease(d3.easeLinear)
        .attr('x', 760).attr('opacity', 1)
        .transition().duration(0).attr('opacity', 0)
        .on('end', scanOnce);
      scanOnce();
    };
    const startDistributionAnimation = () => {
      if (distributionHasEntered) return;
      distributionHasEntered = true;
      distribution.classed('is-visible', true);
      drawDistribution(distributionMetric, true);
      runDistributionScan();
    };
    if ('IntersectionObserver' in window) {
      distributionObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          startDistributionAnimation();
          distributionObserver.disconnect();
        }
      }, { threshold: 0.22 });
      distributionObserver.observe(distribution.node());
    } else {
      startDistributionAnimation();
    }

    const chart = chartPanel.append('div').attr('class', 'gallery-bar-chart');
    let chartData = [];
    const renderBars = (metric, animate) => {
      chartData = [...puzzles]
        .sort((a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0))
        .slice(0, 8);
      const maxSolves = Math.max(1, ...chartData.map(p => Number(p[metric]) || 0));
      chart.selectAll('*').remove();
      if (!chartData.length) {
        chart.append('p').attr('class', 'gallery-empty-chart').text('No puzzles match the current search.');
        return;
      }
      chartData.forEach((puzzle, index) => {
        const value = Number(puzzle[metric]) || 0;
        const row = chart.append('button')
          .attr('type', 'button')
          .attr('class', 'gallery-bar-row')
          .attr('title', `${puzzle.title}: ${galleryNumber(value)} ${metric === 'solves' ? 'LMD' : 'SudokuPad'} solves`)
          .attr('aria-label', `Show ${puzzle.title}, ${galleryNumber(value)} ${metric === 'solves' ? 'LMD' : 'SudokuPad'} solves`)
          .on('click', () => {
            gallerySelectedPuzzle = puzzle.id;
            root.selectAll('.gallery-puzzle-card').classed('is-selected', d => d.id === puzzle.id);
            const target = document.getElementById(`gallery-${puzzle.id}`);
            if (target) target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
          });
        row.append('span').attr('class', 'gallery-bar-name').text(puzzle.title || 'Untitled puzzle');
        const track = row.append('span').attr('class', 'gallery-bar-track');
        const fill = track.append('span').attr('class', 'gallery-bar-fill')
          .style('width', '0%')
          .style('transform-origin', 'left center');
        row.append('strong').attr('class', 'gallery-bar-value').text(galleryNumber(value));
        const targetWidth = `${Math.max(value > 0 ? 1.5 : 0, value / maxSolves * 100)}%`;
        if (animate && !distributionMotionReduced) {
          fill.transition().delay(index * 65).duration(720).ease(d3.easeCubicOut).style('width', targetWidth);
        } else {
          fill.style('width', targetWidth);
        }
      });
    };
    renderBars('sudokupad_solves', false);

    const insightPanel = analysis.append('section').attr('class', 'gallery-insight-panel');
    insightPanel.append('h2').text('Collection snapshot');
    insightPanel.append('p').attr('class', 'gallery-insight-intro').text('A live summary of the puzzles currently in view.');
    const rated = puzzles.filter(p => puzzleRating(p) !== null);
    const topRated = [...rated].sort((a, b) => puzzleRating(b) - puzzleRating(a))[0];
    const mostPlayed = [...puzzles].sort((a, b) => (Number(b.sudokupad_solves) || 0) - (Number(a.sudokupad_solves) || 0))[0];
    const insightList = insightPanel.append('div').attr('class', 'gallery-insight-list');
    [
      { label: 'Highest rating', value: topRated ? `${topRated.title} · ${galleryRatingText(topRated)}` : 'No ratings available', kind: 'rating' },
      { label: 'Most played', value: mostPlayed ? `${mostPlayed.title} · ${galleryNumber(Number(mostPlayed.sudokupad_solves) || 0)} solves` : 'No puzzles to compare', kind: 'plays' },
      { label: 'Rating coverage', value: puzzles.length ? `${Math.round(rated.length / puzzles.length * 100)}% of shown puzzles` : '0% of shown puzzles', kind: 'coverage' }
    ].forEach(item => {
      const line = insightList.append('div').attr('class', 'gallery-insight-row');
      line.append('span').attr('class', `gallery-insight-mark mark-${item.kind}`);
      const copy = line.append('div');
      copy.append('span').attr('class', 'gallery-insight-label').text(item.label);
      copy.append('strong').attr('class', 'gallery-insight-value').text(item.value);
    });

    const galleryHead = root.append('div').attr('class', 'gallery-results-heading');
    const headingCopy = galleryHead.append('div');
    headingCopy.append('h2').text('Explore puzzles');
    headingCopy.append('p').text('Open a puzzle, compare its stats, or sort the collection.');
    const sortWrap = galleryHead.append('label').attr('class', 'gallery-sort-wrap');
    sortWrap.append('span').text('Sort by');
    const sort = sortWrap.append('select')
      .attr('aria-label', 'Sort gallery puzzles')
      .on('change', function () {
        const [key, direction] = this.value.split(':');
        archiveState.sortKey = key;
        archiveState.sortDirection = direction;
        renderArchive(false, true);
      });
    [
      ['date:desc', 'Newest first'],
      ['date:asc', 'Oldest first'],
      ['rating:desc', 'Highest rated'],
      ['sudokupad_solves:desc', 'Most played'],
      ['solves:desc', 'Most LMD solves'],
      ['difficulty:asc', 'Easiest first'],
      ['difficulty:desc', 'Hardest first']
    ].forEach(([value, label]) => sort.append('option').attr('value', value).text(label));
    sort.property('value', `${archiveState.sortKey}:${archiveState.sortDirection}`);

    const grid = root.append('div').attr('class', 'gallery-card-grid');
    if (!puzzles.length) {
      grid.append('div').attr('class', 'gallery-empty-state')
        .append('strong').text('No puzzles found');
      grid.select('.gallery-empty-state').append('p')
        .text(archiveState.search ? `No puzzle matches "${archiveState.search}".` : 'There are no puzzles to display.');
      return;
    }

    puzzles.forEach((puzzle, index) => {
      const card = grid.append('article')
        .datum(puzzle)
        .attr('id', `gallery-${puzzle.id}`)
        .attr('class', `gallery-puzzle-card${gallerySelectedPuzzle === puzzle.id ? ' is-selected' : ''}`)
        .style('--card-index', index)
        .attr('aria-label', puzzle.title || 'Puzzle');

      const imageLink = card.append('a')
        .attr('class', 'gallery-card-image')
        .attr('href', puzzle.puzz ? puzzle.puzz + (puzzle.qs || '') : '#')
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer')
        .attr('aria-label', `Play ${puzzle.title || 'puzzle'}`);
      if (puzzle.image) {
        imageLink.append('img')
          .attr('src', puzzle.image)
          .attr('alt', `${puzzle.title || 'Puzzle'} preview`)
          .attr('loading', index < 2 ? 'eager' : 'lazy')
          .attr('decoding', 'async');
      } else {
        imageLink.append('div').attr('class', 'gallery-image-placeholder')
          .append('span').text('Puzzle preview unavailable');
      }
      const imageOverlay = imageLink.append('span').attr('class', 'gallery-image-overlay');
      appendActionIcon(imageOverlay, 'play');
      imageOverlay.append('span').text('OPEN PUZZLE');

      const body = card.append('div').attr('class', 'gallery-card-body');
      const top = body.append('div').attr('class', 'gallery-card-topline');
      top.append('span').attr('class', 'gallery-puzzle-number').text(`#${puzzle.num}`);
      top.append('span').attr('class', 'gallery-puzzle-date').text(puzzle.date || 'Date unavailable');
      body.append('h3').text(puzzle.title || 'Untitled puzzle');

      const starsRow = body.append('div').attr('class', 'gallery-stars-row');
      drawStars(starsRow, puzzle.stars, puzzle.author_rated === true, 13);
      starsRow.append('span').attr('class', 'gallery-rating-value').text(galleryRatingText(puzzle));

      const rating = puzzleRating(puzzle);
      const ratingTrack = body.append('div').attr('class', 'gallery-rating-track');
      ratingTrack.append('span').attr('class', 'gallery-rating-fill')
        .style('width', `${rating === null ? 0 : Math.max(0, Math.min(100, rating))}%`);

      const stats = body.append('div').attr('class', 'gallery-card-stats');
      [
        { label: 'SudokuPad', value: galleryNumber(Number(puzzle.sudokupad_solves) || 0) },
        { label: 'LMD', value: galleryNumber(Number(puzzle.solves) || 0) }
      ].forEach(stat => {
        const item = stats.append('div').attr('class', 'gallery-card-stat');
        item.append('span').text(stat.label);
        item.append('strong').text(stat.value);
      });

      const actions = body.append('div').attr('class', 'gallery-card-actions');
      if (puzzle.puzz) {
        const playButton = actions.append('a').attr('class', 'gallery-play-button')
          .attr('href', puzzle.puzz + (puzzle.qs || ''))
          .attr('target', '_blank').attr('rel', 'noopener noreferrer');
        appendActionIcon(playButton, 'play');
        playButton.append('span').text('Play on SudokuPad');
      }
      if (puzzle.lmd) {
        const lmdButton = actions.append('a').attr('class', 'gallery-lmd-link')
          .attr('href', lmdLink(puzzle.lmd))
          .attr('target', '_blank').attr('rel', 'noopener noreferrer');
        appendActionIcon(lmdButton, 'link');
        lmdButton.append('span').text('LMD Link');
      }

      card.on('pointermove', function (event) {
        if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const rect = this.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        this.style.setProperty('--pointer-x', `${x * 100}%`);
        this.style.setProperty('--pointer-y', `${y * 100}%`);
        this.style.setProperty('--tilt-x', `${(0.5 - y) * 2.4}deg`);
        this.style.setProperty('--tilt-y', `${(x - 0.5) * 2.8}deg`);
      }).on('pointerleave', function () {
        this.style.setProperty('--tilt-x', '0deg');
        this.style.setProperty('--tilt-y', '0deg');
      });
    });
  };

  // ---------------------------------------------------------
  // Archive rendering
  // ---------------------------------------------------------

  const renderArchive = (
    preserveSearchFocus = false,
    animate = false
  ) => {
    if (
      !cache.data
    ) {
      return;
    }

    const previousRows =
      animate
        ? new Map(
            Array.from(
              document.querySelectorAll(
                '#summary-table .rec'
              )
            ).map(
              row => [
                row.id,
                row.getBoundingClientRect().top
              ]
            )
          )
        : null;

    const activeElement =
      document.activeElement;

    const searchWasFocused =
      preserveSearchFocus &&
      activeElement &&
      activeElement.classList.contains(
        'archive-search-input'
      );

    let selectionStart = null;
    let selectionEnd = null;

    if (searchWasFocused) {
      selectionStart =
        activeElement.selectionStart;

      selectionEnd =
        activeElement.selectionEnd;
    }

    hideTooltip();

    const items =
      cache.data.items || [];

    const filtered =
      filteredPuzzles(
        items
      );

    const sorted =
      sortPuzzles(
        filtered
      );

    summs.html('');

    genArchiveControls();

    if (archiveMode === 'gallery') {
      renderGallery(sorted);
      if (searchWasFocused) {
        const newInput = document.querySelector('#summary-table .archive-search-input');
        if (newInput) {
          newInput.focus();
          if (selectionStart !== null && selectionEnd !== null) {
            newInput.setSelectionRange(selectionStart, selectionEnd);
          }
        }
      }
      return;
    }

    genSummaryHeader();

    if (
      !sorted.length
    ) {
      const empty =
        summs
          .append('div')
          .attr(
            'class',
            'archive-empty'
          );

      empty
        .append('strong')
        .text(
          'No puzzles found'
        );

      empty
        .append('span')
        .text(
          archiveState.search
            ? `No puzzle matches "${archiveState.search}".`
            : 'There are no puzzles to display.'
        );

      if (searchWasFocused) {
        const newInput =
          document.querySelector(
            '#summary-table .archive-search-input'
          );

        if (newInput) {
          newInput.focus();

          if (
            selectionStart !== null &&
            selectionEnd !== null
          ) {
            newInput.setSelectionRange(
              selectionStart,
              selectionEnd
            );
          }
        }
      }

      return;
    }

    sorted.forEach(
      createArchiveRow
    );

    if (animate) {
      const rows =
        Array.from(
          document.querySelectorAll(
            '#summary-table .rec'
          )
        );

      requestAnimationFrame(() => {
        rows.forEach(
          row => {
            const previousTop =
              previousRows &&
              previousRows.get(row.id);

            if (
              previousTop !== undefined
            ) {
              const currentTop =
                row.getBoundingClientRect().top;

              const delta =
                previousTop - currentTop;

              if (
                Math.abs(delta) > 1
              ) {
                row.style.transform =
                  `translateY(${delta}px)`;
              }
            } else {
              row.style.opacity = '0';
              row.style.transform =
                'translateY(6px)';
            }
          }
        );

        requestAnimationFrame(() => {
          rows.forEach(
            row => {
              row.style.transform = '';
              row.style.opacity = '';
            }
          );
        });
      });
    }

    if (searchWasFocused) {
      const newInput =
        document.querySelector(
          '#summary-table .archive-search-input'
        );

      if (newInput) {
        newInput.focus();

        if (
          selectionStart !== null &&
          selectionEnd !== null
        ) {
          newInput.setSelectionRange(
            selectionStart,
            selectionEnd
          );
        }
      }
    }
  };

  // ---------------------------------------------------------
  // State
  // ---------------------------------------------------------

  function getPuzzleState(d) {
    return JSON.stringify(
      (d.items || []).map(
        i => ({
          num: i.num,
          id: i.id,
          title: i.title,
          date: i.date,
          stars: i.stars,
          author_rated:
            i.author_rated === true,
          puzz: i.puzz,
          lmd: i.lmd,
          solves: i.solves,
          sudokupad_solves:
            i.sudokupad_solves,
          rating: i.rating,
          qs: i.qs || '',
          image: i.image || ''
        })
      )
    );
  }

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  function renderData(
    d,
    newEntryIds = []
  ) {
    recent.html('');

    cache.titles = {};
    cache.images = {};
    cache.hovered = null;

    genMostRecent(d);

    cache.data =
      JSON.parse(
        JSON.stringify(d)
      );

    cache.state =
      getPuzzleState(d);

    genDashboard(d);

    renderUpdateMonitor(
      newEntryIds
    );

    renderArchive();
  }

  // ---------------------------------------------------------
  // Update timer
  // ---------------------------------------------------------

  function updateTimer() {
    if (!lastCheckTime) {
      return;
    }

    const now =
      new Date();

    const diffSec =
      Math.max(
        0,
        Math.floor(
          (now - lastCheckTime) /
            1000
        )
      );

    let text;

    if (
      diffSec < 60
    ) {
      text =
        `Last checked: ${diffSec} seconds ago`;
    } else if (
      diffSec < 3600
    ) {
      const min =
        Math.floor(
          diffSec / 60
        );

      const sec =
        diffSec % 60;

      text =
        `Last checked: ${min} min ${sec} sec ago`;
    } else {
      const hr =
        Math.floor(
          diffSec / 3600
        );

      const min =
        Math.floor(
          (diffSec % 3600) / 60
        );

      text =
        `Last checked: ${hr} hr ${min} min ago`;
    }

    d3.select('#since')
      .select('.update-text')
      .text(text);
  }

  // ---------------------------------------------------------
  // Fetch config
  // ---------------------------------------------------------

  async function fetchConfig() {
    const response =
      await fetch(confPath, { cache: 'no-cache' });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.json();
  }

  // ---------------------------------------------------------
  // Check for updates
  // ---------------------------------------------------------

  async function checkForUpdates() {
    try {
      const d =
        await fetchConfig();

      if (!d.last_check) {
        return;
      }

      const newCheck =
        d.last_check !==
        lastCheckRaw;

      const newState =
        getPuzzleState(d);

      const dataChanged =
        newState !==
        cache.state;

      if (newCheck) {
        lastCheckRaw =
          d.last_check;

        lastCheckTime =
          new Date(
            d.last_check
          );

        updateTimer();

        if (dataChanged) {
          renderData(d);
        }

        const newEntryIds =
          await fetchUpdateLog();

        if (newEntryIds.length) {
          renderUpdateMonitor(
            newEntryIds
          );
        }

        return;
      }

      if (dataChanged) {
        renderData(d);
      }

      const newEntryIds =
        await fetchUpdateLog();

      if (newEntryIds.length) {
        renderUpdateMonitor(
          newEntryIds
        );
      }

    } catch (error) {
      console.warn(
        'Unable to check puzzle data:',
        error
      );
    }
  }

  // ---------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------

  async function initialLoad() {
    try {
      const d =
        await fetchConfig();

      if (!d.last_check) {
        renderData(d);
        return;
      }

      lastCheckRaw =
        d.last_check;

      lastCheckTime =
        new Date(
          d.last_check
        );

      renderData(d);

      updateTimer();

      setInterval(updateTimer, 1000);
      setInterval(checkForUpdates, 30000);

      // Render the puzzle archive immediately; the update history can load after it.
      fetchUpdateLog().then(newEntryIds => {
        renderUpdateMonitor(newEntryIds);
      });

    } catch (error) {
      console.error(
        'Failed to load puzzle data:',
        error
      );
    }
  }

  // ---------------------------------------------------------
  // Dashboard container
  // ---------------------------------------------------------

  const createDashboardContainer = () => {
    if (
      !d3.select(
        '#puzzle-dashboard'
      ).empty()
    ) {
      return;
    }

    const listing =
      d3.select(
        '.listing-section'
      );

    if (
      listing.empty()
    ) {
      return;
    }

    listing
      .insert(
        'aside',
        '#summary-table'
      )
      .attr(
        'id',
        'puzzle-dashboard'
      )
      .attr(
        'class',
        'puzzle-dashboard'
      )
      .attr(
        'aria-label',
        'Puzzle dashboard'
      );
  };

  createDashboardContainer();

  // ---------------------------------------------------------
  // Start
  // ---------------------------------------------------------

  initialLoad();

})();
