(() => {
const confPath = './config.json';
const cache = { titles: {}, hovered: null };
const recent = d3.select('#most-recent');
const summs = d3.select('#summary-table');

let lastCheckTime = null;

const setLink = (node, url, qs) => node.append('a').attr('href', url + qs).attr('target', '_blank').text('[play]');
const lmdLink = code => `https://logic-masters.de/Raetselportal/Raetsel/zeigen.php?id=${code}`;
const setLmd = (node, code) => node.append('a').attr('href', lmdLink(code)).attr('target', '_blank').text('[LMD]');

const genSummaryItems = d => {
    d.items.forEach(i => {
        const id = i.id;
        const div = summs.append('div').attr('id', `st-${id}`).attr('class', 'rec');
        const ul = div.append('ul');
        ul.append('li').text(`#${i.num}`);
        ul.append('li').text(i.title);
        cache.titles[id] = i.title;
        ul.append('li').text(i.date);
        _iEtsh_.logo.drawStarBar(ul.append('li'), i.stars);
        setLmd(ul.append('li'), i.lmd);
        setLink(ul.append('li'), i.puzz, i.qs || '');
        ul.append('li').attr('class', 'nsolves').text(`${i.solves || 0} solves`);
        ul.append('li').attr('class', 'rating').text(i.rating || 'N/A');
    });
};

const recentStats = (div, i) => {
    div.append('h3').text(i.title);
    div.append('p').attr('class', 'date').text(i.date);
    _iEtsh_.logo.drawStarBar(div.append('div'), i.stars, 30);
    div.append('p').attr('class', 'spacer');
    div.append('p').attr('class', 'nsolves').html(`Solved ${i.solves || 0} times`);
    setLink(div.append('p'), i.puzz, i.qs || '');
    setLmd(div.append('p'), i.lmd);
};

const genMostRecent = d => {
    const i = d.items[0];
    const div = recent.append('div');
    const mc = div.append('div').attr('class', 'multicol');
    recentStats(mc.append('div').attr('class', 'desc'), i);
};

const tooltip = d3.select('#tooltip');
const onMouseMove = ev => {
    const mPos = d3.pointer(ev);
    let t = d3.select(ev.target);
    let p = t.node().parentNode;
    while (p && !t.classed('rec')) { t = d3.select(p); p = t.node().parentNode; }
    if (p) {
        if (cache.hovered) cache.hovered.style('background-color', null);
        cache.hovered = t;
        t.style('background-color', '#336');
        const id = t.attr('id').slice(3);
        tooltip.select('.caption').text(cache.titles[id]);
        tooltip.style('transform', `translate(calc(-50% + ${mPos[0]}px), calc(-100% + ${mPos[1] - 15}px))`);
        tooltip.style('opacity', 1);
    } else {
        if (cache.hovered) { cache.hovered.style('background-color', null); cache.hovered = null; }
        tooltip.style('opacity', 0);
    }
};

function updateTimer() {
    if (!lastCheckTime) return;
    const now = new Date();
    const diffSec = Math.floor((now - lastCheckTime) / 1000);
    let text = "";
    if (diffSec < 0) {
        text = "Last updated: just now";
    } else if (diffSec < 60) {
        text = `Last updated: ${diffSec} seconds ago`;
    } else if (diffSec < 3600) {
        const min = Math.floor(diffSec / 60);
        const sec = diffSec % 60;
        text = `Last updated: ${min} min ${sec} sec ago`;
    } else {
        const hr = Math.floor(diffSec / 3600);
        const min = Math.floor((diffSec % 3600) / 60);
        text = `Last updated: ${hr} hr ${min} min ago`;
    }
    d3.select('#since').text(text);
}

d3.json(confPath).then(d => {
    genMostRecent(d);
    genSummaryItems(d);
    
    if (d.last_check) {
        lastCheckTime = new Date(d.last_check);
        updateTimer();
        setInterval(updateTimer, 1000);
    }
});
d3.select('#content').on('mousemove', onMouseMove);
})();
