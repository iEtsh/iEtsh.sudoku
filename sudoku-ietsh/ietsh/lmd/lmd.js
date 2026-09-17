(() => {
  const confPath = './config.json';

  const cache = {
    titles: {},
    hovered: null,
    data: null,
    state: null
  };

  const recent = d3.select('#most-recent');
  const summs = d3.select('#summary-table');
  const tooltip = d3.select('#tooltip');

  let lastCheckRaw = null;
  let lastCheckTime = null;

  // ---------------------------------------------------------
  // Action buttons
  // ---------------------------------------------------------

  const setLink = (node, url, qs) => {
    if (!url) return;

    const link = node.append('a')
      .attr('href', url + (qs || ''))
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .attr('class', 'archive-action play-action')
      .attr('title', 'Play this puzzle')
      .attr('aria-label', 'Play this puzzle');

    link.append('span')
      .attr('class', 'action-icon')
      .text('▶');
  };

  const lmdLink = code =>
    `https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=${code}`;

  const setLmd = (node, code) => {
    if (!code) return;

    const link = node.append('a')
      .attr('href', lmdLink(code))
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .attr('class', 'archive-action lmd-action')
      .attr('title', 'View this puzzle on Logic Masters Germany')
      .attr('aria-label', 'View this puzzle on Logic Masters Germany');

    link.append('span')
      .attr('class', 'action-icon')
      .text('↗');
  };

  // ---------------------------------------------------------
  // Latest Puzzle
  // ---------------------------------------------------------

  const recentStats = (info, i) => {

    const top = info
      .append('div')
      .attr('class', 'latest-top');

    top.append('span')
      .attr('class', 'latest-badge')
      .text('LATEST PUZZLE');

    top.append('span')
      .attr('class', 'latest-number')
      .text(`#${i.num}`);

    info.append('h2')
      .attr('class', 'latest-title')
      .text(i.title);

    info.append('p')
      .attr('class', 'latest-date')
      .text(i.date);

    // -------------------------------------------------------
    // Stars
    // Original working version
    // -------------------------------------------------------

    _iEtsh_.logo.drawStarBar(
      info.append('div'),
      i.stars,
      30
    );

    const meta = info
      .append('div')
      .attr('class', 'latest-meta');

    const solves = meta
      .append('div')
      .attr('class', 'meta-pill');

    solves.append('span')
      .text('SOLVED');

    solves.append('strong')
      .text(`${i.solves || 0}`);

    const rating = meta
      .append('div')
      .attr('class', 'meta-pill');

    rating.append('span')
      .text('RATING');

    rating.append('strong')
      .text(i.rating || 'N/A');

    const actions = info
      .append('div')
      .attr('class', 'latest-actions');

    if (i.puzz) {
      const play = actions
        .append('a')
        .attr('href', i.puzz + (i.qs || ''))
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer')
        .attr('class', 'action-btn play-btn')
        .attr('title', 'Play this puzzle')
        .attr('aria-label', 'Play this puzzle');

      play.append('span')
        .attr('class', 'action-icon')
        .text('▶');

      play.append('span')
        .attr('class', 'action-label')
        .text('PLAY');
    }

    if (i.lmd) {
      const lmd = actions
        .append('a')
        .attr('href', lmdLink(i.lmd))
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer')
        .attr('class', 'action-btn lmd-btn')
        .attr('title', 'View this puzzle on Logic Masters Germany')
        .attr('aria-label', 'View this puzzle on Logic Masters Germany');

      lmd.append('span')
        .attr('class', 'action-icon')
        .text('↗');

      lmd.append('span')
        .attr('class', 'action-label')
        .text('LMD');
    }
  };

  const genMostRecent = d => {
    const i = d.items && d.items[0];

    if (!i) return;

    const card = recent
      .append('div')
      .attr('class', 'latest-card');

    const glow = card
      .append('div')
      .attr('class', 'latest-glow');

    const numberBg = card
      .append('div')
      .attr('class', 'latest-number-bg')
      .text(`#${i.num}`);

    const inner = card
      .append('div')
      .attr('class', 'latest-inner');

    const info = inner
      .append('div')
      .attr('class', 'latest-info');

    recentStats(info, i);
  };

  // ---------------------------------------------------------
  // Archive
  // ---------------------------------------------------------

  const genSummaryItems = d => {
    (d.items || []).forEach(i => {

      const id = i.id;

      const div = summs
        .append('div')
        .attr('id', `st-${id}`)
        .attr('class', 'rec');

      const ul = div.append('ul');

      // Number
      ul.append('li')
        .attr('class', 'archive-number')
        .text(`#${i.num}`);

      // Title
      ul.append('li')
        .attr('class', 'archive-title')
        .text(i.title);

      cache.titles[id] = i.title;

      // Date
      ul.append('li')
        .attr('class', 'archive-date')
        .text(i.date);

      // -------------------------------------------------------
      // Stars
      // Original working version
      // -------------------------------------------------------

      _iEtsh_.logo.drawStarBar(
        ul.append('li'),
        i.stars
      );

      // LMD
      const lmd = ul.append('li')
        .attr('class', 'archive-link');

      setLmd(lmd, i.lmd);

      // Play
      const play = ul.append('li')
        .attr('class', 'archive-link');

      setLink(
        play,
        i.puzz,
        i.qs || ''
      );

      // Solves
      ul.append('li')
        .attr('class', 'archive-solves')
        .text(`${i.solves || 0}`);

      // Rating
      ul.append('li')
        .attr('class', 'archive-rating')
        .text(i.rating || 'N/A');
    });
  };

  // ---------------------------------------------------------
  // State
  // ---------------------------------------------------------

  function getPuzzleState(d) {
    return JSON.stringify(
      (d.items || []).map(i => ({
        num: i.num,
        id: i.id,
        title: i.title,
        date: i.date,
        stars: i.stars,
        puzz: i.puzz,
        lmd: i.lmd,
        solves: i.solves,
        rating: i.rating,
        qs: i.qs || ''
      }))
    );
  }

  function renderData(d) {
    recent.html('');
    summs.html('');

    cache.titles = {};
    cache.hovered = null;

    genMostRecent(d);
    genSummaryItems(d);

    cache.data = JSON.parse(JSON.stringify(d));
    cache.state = getPuzzleState(d);
  }

  // ---------------------------------------------------------
  // Update timer
  // ---------------------------------------------------------

  function updateTimer() {
    if (!lastCheckTime) return;

    const now = new Date();

    const diffSec = Math.max(
      0,
      Math.floor((now - lastCheckTime) / 1000)
    );

    let text;

    if (diffSec < 60) {

      text = `Last checked: ${diffSec} seconds ago`;

    } else if (diffSec < 3600) {

      const min = Math.floor(diffSec / 60);
      const sec = diffSec % 60;

      text = `Last checked: ${min} min ${sec} sec ago`;

    } else {

      const hr = Math.floor(diffSec / 3600);
      const min = Math.floor((diffSec % 3600) / 60);

      text = `Last checked: ${hr} hr ${min} min ago`;
    }

    d3.select('#since')
      .select('.update-text')
      .text(text);
  }

  // ---------------------------------------------------------
  // Fetch config
  // ---------------------------------------------------------

  async function fetchConfig() {
    const response = await fetch(
      confPath + '?t=' + Date.now(),
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

      const d = await fetchConfig();

      if (!d.last_check) return;

      const newCheck =
        d.last_check !== lastCheckRaw;

      const newState =
        getPuzzleState(d);

      const dataChanged =
        newState !== cache.state;

      if (newCheck) {

        lastCheckRaw = d.last_check;
        lastCheckTime = new Date(d.last_check);

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

      const d = await fetchConfig();

      if (!d.last_check) {
        renderData(d);
        return;
      }

      lastCheckRaw = d.last_check;
      lastCheckTime = new Date(d.last_check);

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

  const onMouseMove = ev => {

    const mPos = d3.pointer(ev);

    let t = d3.select(ev.target);
    let node = t.node();

    if (!node) return;

    let p = node.parentNode;

    while (
      p &&
      !t.classed('rec')
    ) {
      t = d3.select(p);

      const currentNode = t.node();

      if (!currentNode) break;

      p = currentNode.parentNode;
    }

    if (p) {

      if (cache.hovered) {
        cache.hovered.style(
          'background-color',
          null
        );
      }

      cache.hovered = t;

      t.style(
        'background-color',
        'rgba(255,255,255,0.04)'
      );

      const id =
        t.attr('id').slice(3);

      tooltip
        .select('.caption')
        .text(
          cache.titles[id] || ''
        );

      tooltip
        .style(
          'transform',
          `translate(calc(-50% + ${mPos[0]}px), calc(-100% + ${mPos[1] - 15}px))`
        )
        .style('opacity', 1);

    } else {

      if (cache.hovered) {

        cache.hovered.style(
          'background-color',
          null
        );

        cache.hovered = null;
      }

      tooltip.style(
        'opacity',
        0
      );
    }
  };

  d3.select('#content')
    .on(
      'mousemove',
      onMouseMove
    );

  initialLoad();

})();
