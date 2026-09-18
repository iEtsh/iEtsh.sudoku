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

    link
      .append('span')
      .attr(
        'class',
        'action-icon'
      )
      .text('▶');
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

    link
      .append('span')
      .attr(
        'class',
        'action-icon'
      )
      .text('↗');
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

    top
      .append('span')
      .attr(
        'class',
        'latest-number'
      )
      .text(`#${i.num}`);

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
        `${i.solves || 0}`
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

      play
        .append('span')
        .attr(
          'class',
          'action-icon'
        )
        .text('▶');

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

      lmd
        .append('span')
        .attr(
          'class',
          'action-icon'
        )
        .text('↗');

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
        .append('img')
        .attr(
          'src',
          i.image
        )
        .attr(
          'alt',
          i.title || 'Puzzle'
        )
        .attr(
          'loading',
          'eager'
        );
    }
  };

  const genMostRecent = d => {
    const i =
      d.items &&
      d.items[0];

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

    const timestamp =
      Date.parse(puzzle.date);

    if (
      Number.isFinite(timestamp)
    ) {
      return timestamp;
    }

    return 0;
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

        /*
         * Stable secondary order:
         * newest puzzle first.
         */
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

      /*
       * First click on a category gives
       * the most useful/highest direction:
       *
       * Date       -> newest
       * Rating     -> highest
       * Solves     -> most
       * Difficulty -> highest
       */
      archiveState.sortDirection =
        'desc';
    }

    renderArchive();
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
      .text('LMD LINK');

    header
      .append('div')
      .attr(
        'class',
        'archive-header-link'
      )
      .text('PLAY');

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

    input
      .on(
        'input',
        function () {
          archiveState.search =
            this.value;

          renderArchive();
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
        }

        if (
          ev.key === 'Escape'
        ) {
          input
            .property(
              'value',
              ''
            );

          archiveState.search =
            '';

          renderArchive();
        }
      }
    );
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
        (sum, puzzle) =>
          sum +
          puzzleSolves(puzzle),
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
      d3.select('#puzzle-dashboard');

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
  };

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
        puzzle.author_rated === true
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
      // LMD Solvers
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-solves'
        )
        .text(
          `${puzzle.solves || 0}`
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
          puzzle.rating || 'N/A'
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
  // Archive rendering
  // ---------------------------------------------------------

  const renderArchive = () => {
    if (
      !cache.data
    ) {
      return;
    }

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

      return;
    }

    sorted.forEach(
      createArchiveRow
    );

    /*
     * Restore focus to the first visible
     * puzzle when the archive is rebuilt.
     *
     * Do not steal focus from the search
     * box or sorting buttons.
     */
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

  function renderData(d) {
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

    /*
     * Dashboard is rendered separately from
     * the archive so it always reflects the
     * complete collection, not the search
     * results.
     */
    genDashboard(d);

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
      await fetch(
        confPath +
          '?t=' +
          Date.now(),
        {
          cache: 'no-store'
        }
      );

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

        return;
      }

      if (dataChanged) {
        renderData(d);
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

      setInterval(
        updateTimer,
        1000
      );

      setInterval(
        checkForUpdates,
        30000
      );

    } catch (error) {
      console.error(
        'Failed to load puzzle data:',
        error
      );
    }
  }

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

  const showTooltip = (
    id,
    title,
    x,
    y
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
        'transform',
        `translate(calc(-50% + ${x}px), calc(-100% + ${y - 15}px))`
      )
      .style(
        'opacity',
        1
      );
  };

  const onMouseMove = ev => {
    const mPos =
      d3.pointer(ev);

    let t =
      d3.select(
        ev.target
      );

    let node =
      t.node();

    if (!node) {
      return;
    }

    let p =
      node.parentNode;

    while (
      p &&
      !t.classed('rec')
    ) {
      t =
        d3.select(p);

      const currentNode =
        t.node();

      if (!currentNode) {
        break;
      }

      p =
        currentNode.parentNode;
    }

    if (
      t &&
      t.classed('rec')
    ) {
      if (
        cache.hovered
      ) {
        cache.hovered.style(
          'background-color',
          null
        );
      }

      cache.hovered =
        t;

      t.style(
        'background-color',
        'rgba(255,255,255,0.04)'
      );

      const rowId =
        t.attr('id');

      if (!rowId) {
        hideTooltip();
        return;
      }

      const id =
        rowId.slice(3);

      showTooltip(
        id,
        cache.titles[id] || '',
        mPos[0],
        mPos[1]
      );

    } else {
      hideTooltip();
    }
  };

  // ---------------------------------------------------------
  // Tooltip events
  // ---------------------------------------------------------

  d3.select('#content')
    .on(
      'mousemove',
      onMouseMove
    )
    .on(
      'mouseleave',
      hideTooltip
    );

  // ---------------------------------------------------------
  // Dashboard container
  // ---------------------------------------------------------

  /*
   * The existing HTML does not need to be manually edited
   * for the dashboard.
   *
   * We create its container next to the archive section.
   * CSS in the next file controls its desktop/mobile layout.
   */

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

    const dashboard =
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
