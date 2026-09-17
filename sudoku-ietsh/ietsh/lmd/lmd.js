(() => {
  const confPath = './config.json';

  const cache = {
    titles: {},
    hovered: null,
    data: null
  };

  const recent = d3.select('#most-recent');
  const summs = d3.select('#summary-table');
  const tooltip = d3.select('#tooltip');

  let lastCheckTime = null;
  let lastCheckRaw = null;

  const setLink = (node, url, qs) => {
    if (!url) return;

    node.append('a')
      .attr('href', url + qs)
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
    d.items.forEach(i => {
      const id = i.id;

      const div = summs
        .append('div')
        .attr('id', `st-${id}`)
        .attr('class', 'rec');

      const ul = div.append('ul');

      ul.append('li').text(`#${i.num}`);

      ul.append('li')
        .text(i.title);

      cache.titles[id] = i.title;

      ul.append('li')
        .text(i.date);

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
    const i = d.items[0];

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
   * Render the complete puzzle data.
   * This is called on first load and whenever
   * the data inside config.json changes.
   */
  function renderData(d) {
    recent.html('');
    summs.html('');

    cache.titles = {};
    cache.hovered = null;
    cache.data = d;

    genMostRecent(d);
    genSummaryItems(d);
  }

  /*
   * Create a stable representation of the actual
   * puzzle data, ignoring last_check.
   *
   * This allows us to distinguish:
   *
   * - Check happened but nothing changed
   * - Check happened and puzzle data changed
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

  function updateTimer() {
    if (!lastCheckTime) return;

    const now = new Date();
    const diffSec = Math.max(
      0,
      Math.floor((now - lastCheckTime) / 1000)
    );

    let text = '';

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
   * Check config.json for a new scraper check.
   *
   * Every time last_check changes:
   *
   * 1. Reset the timer
   * 2. Compare the actual puzzle data
   * 3. Re-render the page if anything changed
   */
  function checkForUpdates() {
    d3.json(confPath + '?t=' + Date.now())
      .then(d => {

        if (!d.last_check) return;

        const newState = getPuzzleState(d);
        const oldState = cache.data
          ? getPuzzleState(cache.data)
          : null;

        /*
         * A new last_check means that the scraper
         * has performed another check on LMD.
         */
        if (d.last_check !== lastCheckRaw) {

          lastCheckRaw = d.last_check;
          lastCheckTime = new Date(d.last_check);

          /*
           * IMPORTANT:
           * Timer resets on EVERY check,
           * even if the puzzle data didn't change.
           */
          updateTimer();

          /*
           * Only rebuild the page if the actual
           * puzzle data changed.
           */
          if (newState !== oldState) {
            renderData(d);
          }
        }
      })
      .catch(() => {
        /*
         * Ignore temporary network errors.
         * The next check will try again.
         */
      });
  }

  /*
   * Initial load.
   *
   * Cache-busting is used here too so the browser
   * doesn't start with an old config.json.
   */
  d3.json(confPath + '?t=' + Date.now())
    .then(d => {

      cache.data = d;

      renderData(d);

      if (d.last_check) {
        lastCheckRaw = d.last_check;
        lastCheckTime = new Date(d.last_check);

        updateTimer();

        /*
         * Update the visible timer every second.
         */
        setInterval(updateTimer, 1000);

        /*
         * Check whether GitHub Actions/scraper
         * produced a newer config.json.
         */
        setInterval(checkForUpdates, 30000);
      }
    })
    .catch(err => {
      console.error('Failed to load puzzle data:', err);
    });

  /*
   * Tooltip / row highlighting
   */
  const onMouseMove = ev => {
    const mPos = d3.pointer(ev);

    let t = d3.select(ev.target);
    let node = t.node();

    if (!node) return;

    let p = node.parentNode;

    while (p && !t.classed('rec')) {
      t = d3.select(p);
      p = t.node().parentNode;
    }

    if (p) {
      if (cache.hovered) {
        cache.hovered.style('background-color', null);
      }

      cache.hovered = t;

      t.style(
        'background-color',
        'rgba(255,255,255,0.04)'
      );

      const id = t.attr('id').slice(3);

      tooltip
        .select('.caption')
        .text(cache.titles[id] || '');

      tooltip
        .style(
          'transform',
          `translate(calc(-50% + ${mPos[0]}px), calc(-100% + ${mPos[1] - 15}px))`
        )
        .style('opacity', 1);

    } else {

      if (cache.hovered) {
        cache.hovered.style('background-color', null);
        cache.hovered = null;
      }

      tooltip.style('opacity', 0);
    }
  };

  d3.select('#content')
    .on('mousemove', onMouseMove);

})();
