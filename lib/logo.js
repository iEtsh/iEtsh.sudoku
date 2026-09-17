window._iEtsh_ = window._iEtsh_ || {};

_iEtsh_.logo = (() => {
    const drawStarBar = (container, stars, size) => {
        const wh = size || 20;
        const svg = container.append('svg')
            .attr('class', 'star-bar')
            .attr('width', wh * 5)
            .attr('height', wh);
        for (let i = 1; i <= 5; i++) {
            const cls = (typeof stars === 'number' && i <= stars) ? 'star-1' : 'star-0';
            svg.append('path')
                .attr('class', cls)
                .attr('transform', `translate(${(i - 1) * wh}, 0)`)
                .attr('d', starPath(wh));
        }
    };
    const starPath = (size) => {
        const s = size / 2;
        const points = [];
        for (let i = 0; i < 5; i++) {
            const angle = (i * 72 - 90) * Math.PI / 180;
            points.push(`${s + s * Math.cos(angle)},${s + s * Math.sin(angle)}`);
            const innerAngle = angle + 36 * Math.PI / 180;
            points.push(`${s + s * 0.4 * Math.cos(innerAngle)},${s + s * 0.4 * Math.sin(innerAngle)}`);
        }
        return `M${points.join(' L')} Z`;
    };
    return { drawStarBar };
})();
