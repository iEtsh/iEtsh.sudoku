(() => {

    const confPath = './config.json';

    const cache = {
        titles: {},
        hovered: null
    };

    const recent = d3.select('#most-recent');
    const summs = d3.select('#summary-table');

    let lastCheckTime = null;
    let lastCheckRaw = null;


    /* =====================================================
       Links
       ===================================================== */

    const setLink = (node, url, qs) => {

        if (!url) return;

        node
            .append('a')
            .attr('href', url + qs)
            .attr('target', '_blank')
            .attr('rel', 'noopener noreferrer')
            .text('[play]');

    };


    const lmdLink = code =>
        `https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=${code}`;


    const setLmd = (node, code) => {

        node
            .append('a')
            .attr('href', lmdLink(code))
            .attr('target', '_blank')
            .attr('rel', 'noopener noreferrer')
            .text('[LMD]');

    };


    /* =====================================================
       Stars
       ===================================================== */

    const drawStars = (container, stars, size) => {

        _iEtsh_.logo.drawStarBar(
            container,
            stars,
            size
        );

    };


    /* =====================================================
       Latest Puzzle
       ===================================================== */

    const genMostRecent = d => {

        const i = d.items[0];

        if (!i) return;


        const card = recent
            .append('div')
            .attr('class', 'latest-card');


        const inner = card
            .append('div')
            .attr('class', 'latest-inner');


        const info = inner
            .append('div')
            .attr('class', 'latest-info');


        info
            .append('div')
            .attr('class', 'latest-badge')
            .text('MOST RECENT');


        info
            .append('h2')
            .attr('class', 'latest-title')
            .text(i.title);


        info
            .append('div')
            .attr('class', 'latest-date')
            .text(i.date);


        const stars = info
            .append('div')
            .attr('class', 'latest-stars');


        drawStars(
            stars,
            i.stars,
            25
        );


        const meta = info
            .append('div')
            .attr('class', 'latest-meta');


        const solves = meta
            .append('div')
            .attr('class', 'meta-pill');


        solves
            .append('strong')
            .text(i.solves || 0);


        solves
            .append('span')
            .text('solves');


        const rating = meta
            .append('div')
            .attr('class', 'meta-pill');


        rating
            .append('strong')
            .text(i.rating || 'N/A');


        rating
            .append('span')
            .text('rating');


        const number = meta
            .append('div')
            .attr('class', 'meta-pill');


        number
            .append('strong')
            .text(`#${i.num}`);


        number
            .append('span')
            .text('puzzle');


        const actions = inner
            .append('div')
            .attr('class', 'latest-actions');


        if (i.puzz) {

            actions
                .append('a')
                .attr('class', 'action-btn play-btn')
                .attr('href', i.puzz + (i.qs || ''))
                .attr('target', '_blank')
                .attr('rel', 'noopener noreferrer')
                .text('PLAY PUZZLE');

        }


        actions
            .append('a')
            .attr('class', 'action-btn lmd-btn')
            .attr('href', lmdLink(i.lmd))
            .attr('target', '_blank')
            .attr('rel', 'noopener noreferrer')
            .text('VIEW ON LMD');

    };


    /* =====================================================
       Puzzle Archive
       ===================================================== */

    const genSummaryItems = d => {

        d.items.forEach((i, index) => {

            const id = i.id;


            const div = summs
                .append('div')
                .attr('id', `st-${id}`)
                .attr('class', 'rec');


            div.style(
                'animation-delay',
                `${Math.min(index * 35, 500)}ms`
            );


            const ul = div
                .append('ul');


            /* Number */

            ul
                .append('li')
                .text(`#${i.num}`);


            /* Title */

            ul
                .append('li')
                .text(i.title);


            cache.titles[id] = i.title;


            /* Date */

            ul
                .append('li')
                .text(i.date);


            /* Stars */

            const starCell = ul
                .append('li');


            drawStars(
                starCell,
                i.stars,
                15
            );


            /* LMD */

            setLmd(
                ul.append('li'),
                i.lmd
            );


            /* Play */

            setLink(
                ul.append('li'),
                i.puzz,
                i.qs || ''
            );


            /* Solves */

            ul
                .append('li')
                .attr('class', 'nsolves')
                .text(`${i.solves || 0} solves`);


            /* Rating */

            ul
                .append('li')
                .attr('class', 'rating')
                .text(i.rating || 'N/A');

        });

    };


    /* =====================================================
       Update Timer
       ===================================================== */

    function updateTimer() {

        if (!lastCheckTime) return;


        const now = new Date();

        const diffSec =
            Math.floor(
                (now - lastCheckTime) / 1000
            );


        let text = "";


        if (diffSec < 0) {

            text = "Updated just now";

        }

        else if (diffSec < 60) {

            text =
                `Updated ${diffSec} seconds ago`;

        }

        else if (diffSec < 3600) {

            const min =
                Math.floor(diffSec / 60);

            const sec =
                diffSec % 60;

            text =
                `Updated ${min} min ${sec} sec ago`;

        }

        else {

            const hr =
                Math.floor(diffSec / 3600);

            const min =
                Math.floor(
                    (diffSec % 3600) / 60
                );

            text =
                `Updated ${hr} hr ${min} min ago`;

        }


        d3.select('#since')
            .select('.update-text')
            .text(text);

    }


    /* =====================================================
       Check for Updates
       ===================================================== */

    function checkForUpdates() {

        d3.json(
            confPath + '?t=' + Date.now()
        )
        .then(d => {

            if (
                d.last_check &&
                d.last_check !== lastCheckRaw
            ) {

                lastCheckRaw =
                    d.last_check;

                lastCheckTime =
                    new Date(d.last_check);

                updateTimer();

            }

        })
        .catch(() => {});

    }


    /* =====================================================
       Tooltip
       ===================================================== */

    const tooltip =
        d3.select('#tooltip');


    const onMouseMove = ev => {

        let t =
            d3.select(ev.target);

        let p =
            t.node().parentNode;


        while (
            p &&
            !t.classed('rec')
        ) {

            t =
                d3.select(p);

            p =
                t.node().parentNode;

        }


        if (p) {

            if (cache.hovered) {

                cache.hovered
                    .style(
                        'background-color',
                        null
                    );

            }


            cache.hovered = t;


            const id =
                t.attr('id')
                    .slice(3);


            tooltip
                .select('.caption')
                .text(cache.titles[id]);


            const mPos =
                d3.pointer(ev);


            tooltip
                .style(
                    'transform',
                    `translate(
                        calc(-50% + ${mPos[0]}px),
                        calc(-100% + ${mPos[1] - 15}px)
                    )`
                )
                .style(
                    'opacity',
                    1
                );

        }

        else {

            if (cache.hovered) {

                cache.hovered
                    .style(
                        'background-color',
                        null
                    );

                cache.hovered = null;

            }


            tooltip
                .style(
                    'opacity',
                    0
                );

        }

    };


    /* =====================================================
       Load Data
       ===================================================== */

    d3.json(confPath)
        .then(d => {

            genMostRecent(d);

            genSummaryItems(d);


            if (d.last_check) {

                lastCheckRaw =
                    d.last_check;

                lastCheckTime =
                    new Date(d.last_check);


                updateTimer();


                setInterval(
                    updateTimer,
                    1000
                );


                setInterval(
                    checkForUpdates,
                    30000
                );

            }

        });


    /* =====================================================
       Mouse Events
       ===================================================== */

    d3.select('#content')
        .on('mousemove', onMouseMove);

})();
