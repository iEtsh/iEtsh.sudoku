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

    /*
     * The Latest card keeps its original dimensions.
     *
     * Left side:
     *   badge
     *   title
     *   date
     *   stars
     *   meta
     *   buttons
     *
     * Right side:
     *   puzzle image
     *
     * The large translucent number is NOT touched.
     */

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


    /*
     * Small number is kept in the top area.
     * CSS moves it to the top-right corner of the card.
     */
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


    /*
     * DO NOT CHANGE THIS.
     * This is the large translucent number.
     */
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
  // Archive
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

    header
      .append('div')
      .attr(
        'class',
        'archive-header-date'
      );

    header
      .append('div')
      .attr(
        'class',
        'archive-header-difficulty'
      )
      .text('DIFFICULTY');

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

    header
      .append('div')
      .attr(
        'class',
        'archive-header-solves'
      )
      .text('LMD SOLVERS');

    header
      .append('div')
      .attr(
        'class',
        'archive-header-rating'
      )
      .text('RATING');
  };


  const genSummaryItems = d => {

    genSummaryHeader();

    (
      d.items || []
    ).forEach(i => {

      const id = i.id;

      const div = summs
        .append('div')
        .attr(
          'id',
          `st-${id}`
        )
        .attr(
          'class',
          'rec'
        );


      const ul = div
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
        .text(`#${i.num}`);


      // -----------------------------------------------------
      // Title
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-title'
        )
        .text(i.title);


      cache.titles[id] =
        i.title;

      cache.images[id] =
        i.image || '';


      // -----------------------------------------------------
      // Date
      // -----------------------------------------------------

      ul
        .append('li')
        .attr(
          'class',
          'archive-date'
        )
        .text(i.date);


      // -----------------------------------------------------
      // Difficulty
      // -----------------------------------------------------

      drawStars(
        ul.append('li'),
        i.stars,
        i.author_rated === true
      );


      // -----------------------------------------------------
      // LMD Link
      // -----------------------------------------------------

      const lmd = ul
        .append('li')
        .attr(
          'class',
          'archive-link'
        );

      setLmd(
        lmd,
        i.lmd
      );


      // -----------------------------------------------------
      // Play
      // -----------------------------------------------------

      const play = ul
        .append('li')
        .attr(
          'class',
          'archive-link'
        );

      setLink(
        play,
        i.puzz,
        i.qs || ''
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
          `${i.solves || 0}`
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
          i.rating || 'N/A'
        );
    });
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
    summs.html('');

    cache.titles = {};
    cache.images = {};
    cache.hovered = null;

    genMostRecent(d);
    genSummaryItems(d);

    cache.data =
      JSON.parse(
        JSON.stringify(d)
      );

    cache.state =
      getPuzzleState(d);
  }


  // ---------------------------------------------------------
  // Update timer
  // ---------------------------------------------------------

  function updateTimer() {

    if (!lastCheckTime) return;

    const now =
      new Date();

    const diffSec =
      Math.max(
        0,
        Math.floor(
          (now - lastCheckTime) / 1000
        )
      );

    let text;


    if (diffSec < 60) {

      text =
        `Last checked: ${diffSec} seconds ago`;

    } else if (diffSec < 3600) {

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


      if (!d.last_check)
        return;


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

    if (cache.hovered) {

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


    if (!node) return;


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


      if (!currentNode)
        break;


      p =
        currentNode.parentNode;
    }


    if (
      t &&
      t.classed('rec')
    ) {

      if (cache.hovered) {

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
  // Start
  // ---------------------------------------------------------

  initialLoad();

})();
