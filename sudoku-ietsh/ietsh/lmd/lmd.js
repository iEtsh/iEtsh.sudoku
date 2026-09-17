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

  const setLink = (node, url, qs) => {
    if (!url) return;

    node.append('a')
      .attr('href', url + (qs || ''))
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .text('[play]');
  };

  const lmdLink = code =>
    `https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=${code}`;

  const setLmd = (node, code) => {
    if (!code) return;

    node.append('a')
      .attr('href', lmdLink(code))
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .text('[LMD]');
  };

  const genSummaryItems = d => {
    (d.items || []).forEach(i => {
      const id = i.id;

      const div = summs
        .append('div')
        .attr('id', `st-${id}`)
        .attr('class', 'rec');

      const ul = div.append('ul');

      ul.append('li').text(`#${i.num}`);

      ul.append('li').text(i.title);

      cache.titles[id] = i.title;

      ul.append('li').text(i.date);

      _iEtsh_.logo.drawStarBar(
        ul.append('li'),
        i.stars
      );

      setLmd(
        ul.append('li'),
        i.lmd
      );

      setLink(
        ul.append('li'),
        i.puzz,
        i.qs || ''
      );

      ul.append('li')
        .attr('class', 'nsolves')
        .text(`${i.solves || 0} solves`);

      ul.append('li')
        .attr('class', 'rating')
        .text(i.rating || 'N/A');
    });
  };

  const recentStats = (div, i) => {
    div.append('h3')
      .text(i.title);

    div.append('p')
      .attr('class', 'date')
      .text(i.date);

    _iEtsh_.logo.drawStarBar(
      div.append('div'),
      i.stars,
      30
    );

    div.append('p')
      .attr('class', 'spacer');

    div.append('p')
      .attr('class', 'nsolves')
      .html(`Solved ${i.solves || 0} times`);

    setLink(
      div.append('p'),
      i.puzz,
      i.qs || ''
    );

    setLmd(
      div.append('p'),
      i.lmd
    );
  };

  const genMostRecent = d => {
    const i = d.items && d.items[0];

    if (!i) return;

    const div = recent.append('div');

    const mc = div
      .append('div')
      .attr('class', 'multicol');

    recentStats(
      mc.append('div').attr('class', 'desc'),
      i
    );
  };

  /*
   * Build a stable snapshot of all puzzle data.
   *
   * last_check is deliberately NOT included.
   *
   * Any change to any puzzle field will therefore
   * be detected.
   */
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

  /*
   * Render all puzzle information.
   */
  function renderData(d) {
    recent.html('');
    summs.html('');

    cache.titles = {};
    cache.hovered = null;

    genMostRecent(d);
    genSummaryItems(d);

    /*
     * Store a COPY of the data.
     * This prevents accidental reference sharing.
     */
    cache.data = JSON.parse(JSON.stringify(d));
    cache.state = getPuzzleState(d);
  }

  /*
   * Update the "Last checked" timer.
   */
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

    d3.select('#since').text(text);
  }

  /*
   * Fetch the newest config.json.
   *
   * Cache busting is mandatory here.
   */
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

  /*
   * Check for a new scraper check.
   */
  async function checkForUpdates() {
    try {
      const d = await fetchConfig();

      if (!d.last_check) return;

      /*
       * Has the scraper performed a new check?
       */
      const newCheck =
        d.last_check !== lastCheckRaw;

      /*
       * Has any actual puzzle data changed?
       */
      const newState =
        getPuzzleState(d);

      const dataChanged =
        newState !== cache.state;

      /*
       * If a new scraper check happened:
       *
       * RESET TIMER ALWAYS.
       */
      if (newCheck) {
        lastCheckRaw = d.last_check;
        lastCheckTime = new Date(d.last_check);

        updateTimer();

        /*
         * If the actual puzzle data changed,
         * rebuild the page.
         */
        if (dataChanged) {
          renderData(d);
        }

        return;
      }

      /*
       * Extra protection:
       *
       * If data somehow changes without last_check
       * changing, update the UI anyway.
       */
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

  /*
   * Initial load.
   */
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

      /*
       * Update timer every second.
       */
      setInterval(
        updateTimer,
        1000
      );

      /*
       * Check GitHub Pages config every 30 seconds.
       */
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

  /*
   * Tooltip / row highlighting.
   */
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
