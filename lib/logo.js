window._iEtsh_ = window._iEtsh_ || {};

_iEtsh_.logo = (() => {
    const injectInteractiveEffects = () => {
        if (document.getElementById('ietsh-interactive-effects')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'ietsh-interactive-effects';
        style.textContent = `
            .mouse-follow-glow {
                position: fixed;
                left: 0;
                top: 0;
                width: 260px;
                height: 260px;
                margin-left: -130px;
                margin-top: -130px;
                border-radius: 50%;
                pointer-events: none;
                z-index: 0;
                opacity: 0;
                background: radial-gradient(
                    circle,
                    rgba(104, 120, 184, 0.075) 0%,
                    rgba(104, 120, 184, 0.028) 34%,
                    transparent 70%
                );
                filter: blur(2px);
                transition: opacity 180ms ease;
                will-change: transform;
            }

            .mouse-follow-glow.is-visible {
                opacity: 1;
            }

            .update-monitor {
                width: 100%;
            }

            .update-monitor-list {
                max-height: 520px !important;
                gap: 9px !important;
            }

            .update-entry {
                padding: 13px 14px !important;
            }

            .update-entry-type {
                font-size: 10px !important;
                line-height: 1.4 !important;
            }

            .update-entry-puzzle {
                font-size: 10px !important;
            }

            .update-entry-title {
                margin-top: 6px !important;
                font-size: 12px !important;
                line-height: 1.45 !important;
            }

            .update-entry-time {
                margin-top: 7px !important;
                font-size: 10px !important;
            }

            .update-entry-change {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr);
                align-items: center;
                gap: 7px;
                margin-top: 9px;
                padding-top: 9px;
                border-top: 1px solid rgba(255, 255, 255, 0.055);
            }

            .update-entry-side {
                min-width: 0;
            }

            .update-entry-side-label {
                display: block;
                margin-bottom: 4px;
                color: #687385;
                font-size: 7px;
                line-height: 1;
                font-weight: 700;
                letter-spacing: 1px;
            }

            .update-entry-note {
                margin-top: 9px;
                padding-top: 9px;
                border-top: 1px solid rgba(255, 255, 255, 0.055);
                color: #bfc7d8;
                font-size: 10px;
                line-height: 1.45;
            }

            .update-entry-value {
                min-width: 0;
                padding: 7px 8px;
                border-radius: 7px;
                background: rgba(255, 255, 255, 0.035);
                color: #d9dde7;
                font-size: 10px;
                line-height: 1.35;
                overflow-wrap: anywhere;
            }

            .update-entry-value.previous {
                color: #a0a8b7;
            }

            .update-entry-value.current {
                color: #dce3f5;
                background: rgba(101, 118, 184, 0.10);
            }

            .update-entry-arrow {
                color: #6878b8;
                text-align: center;
                font-size: 14px;
                font-weight: 700;
            }

            @media (max-width: 760px) {
                .update-entry-change {
                    grid-template-columns: minmax(0, 1fr) 14px minmax(0, 1fr);
                    gap: 5px;
                }

                .update-entry-value {
                    font-size: 9px;
                    padding: 6px 7px;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .puzzle-stars:hover .star-bar .star-1 {
                    animation: none;
                }

                .mouse-follow-glow {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);
    };

    const createMouseGlow = () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        if (window.matchMedia('(pointer: coarse)').matches) {
            return;
        }

        if (document.querySelector('.mouse-follow-glow')) {
            return;
        }

        const glow = document.createElement('div');
        glow.className = 'mouse-follow-glow';
        glow.setAttribute('aria-hidden', 'true');
        document.body.appendChild(glow);

        let targetX = -300;
        let targetY = -300;
        let currentX = targetX;
        let currentY = targetY;
        let frame = null;

        const move = event => {
            targetX = event.clientX;
            targetY = event.clientY;
            glow.classList.add('is-visible');

            if (frame !== null) {
                return;
            }

            const animate = () => {
                currentX += (targetX - currentX) * 0.2;
                currentY += (targetY - currentY) * 0.2;

                glow.style.transform =
                    `translate3d(${currentX}px, ${currentY}px, 0)`;

                if (
                    Math.abs(targetX - currentX) > 0.2 ||
                    Math.abs(targetY - currentY) > 0.2
                ) {
                    frame = requestAnimationFrame(animate);
                } else {
                    frame = null;
                }
            };

            frame = requestAnimationFrame(animate);
        };

        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('blur', () => {
            glow.classList.remove('is-visible');
        });
    };

    const setupStarInteraction = container => {
        const node = container.node();
        if (!node || node.dataset.starInteractionReady === 'true') {
            return;
        }

        node.dataset.starInteractionReady = 'true';

        const stars = Array.from(
            node.querySelectorAll('.star-bar .star-1')
        );

        if (!stars.length) {
            return;
        }

        const originalFills = stars.map(star =>
            getComputedStyle(star).fill
        );

        let timers = [];

        const clearTimers = () => {
            timers.forEach(timer => clearTimeout(timer));
            timers = [];
        };

        const resetStars = () => {
            clearTimers();
            stars.forEach((star, index) => {
                const fill = originalFills[index];
                if (fill) {
                    star.style.setProperty('fill', fill, 'important');
                } else {
                    star.style.removeProperty('fill');
                }
                star.style.removeProperty('transform');
            });
            node.classList.remove('is-filling');
        };

        node.addEventListener('mouseenter', () => {
            clearTimers();
            node.classList.add('is-filling');

            stars.forEach(star => {
                star.style.setProperty(
                    'fill',
                    '#303746',
                    'important'
                );
                star.style.opacity = '1';
            });

            stars.forEach((star, index) => {
                timers.push(
                    setTimeout(() => {
                        const fill = originalFills[index];
                        if (fill) {
                            star.style.setProperty(
                                'fill',
                                fill,
                                'important'
                            );
                        }
                    }, index * 180)
                );
            });
        });

        node.addEventListener('mouseleave', resetStars);
    };

    const drawStarBar = (container, stars, size) => {
        const wh = size || 20;
        const svg = container.append('svg')
            .attr('class', 'star-bar')
            .attr('width', wh * 5)
            .attr('height', wh);

        for (let i = 1; i <= 5; i++) {
            const cls =
                (typeof stars === 'number' && i <= stars)
                    ? 'star-1'
                    : 'star-0';

            svg.append('path')
                .attr('class', cls)
                .attr('transform', `translate(${(i - 1) * wh}, 0)`)
                .attr('d', starPath(wh));
        }

        setupStarInteraction(container);
    };

    const starPath = size => {
        const s = size / 2;
        const points = [];

        for (let i = 0; i < 5; i++) {
            const angle = (i * 72 - 90) * Math.PI / 180;
            points.push(
                `${s + s * Math.cos(angle)},${s + s * Math.sin(angle)}`
            );

            const innerAngle = angle + 36 * Math.PI / 180;
            points.push(
                `${s + s * 0.4 * Math.cos(innerAngle)},${s + s * 0.4 * Math.sin(innerAngle)}`
            );
        }

        return `M${points.join(' L')} Z`;
    };

    const installUpdateMonitorEnhancement = () => {
        const detailedTypes = new Set([
            'Title Changed',
            'Date Changed',
            'Difficulty Changed',
            'SudokuPad Link Changed',
            'LMD Link Changed',
            'LMD Solvers Changed',
            'SudokuPad Solvers Changed',
            'Rating Changed'
        ]);

        let lastCount = -1;
        let cachedEntries = null;

        const loadEntries = async () => {
            try {
                const response = await fetch(
                    './update-log.json?t=' + Date.now(),
                    { cache: 'no-store' }
                );
                if (!response.ok) return [];
                const data = await response.json();
                return Array.isArray(data) ? data : [];
            } catch (error) {
                return [];
            }
        };

        const formatValue = (value, field) => {
            if (
                value === null ||
                value === undefined ||
                value === ''
            ) {
                return 'None';
            }

            if (typeof value === 'boolean') {
                return value ? 'Yes' : 'No';
            }

            if (field === 'lmd') {
                return (
                    'https://logic-masters.de/' +
                    'Raetselportal/Raetsel/zeigen.php?id=' +
                    String(value)
                );
            }

            return String(value);
        };

        const applyDetails = async () => {
            const list = document.querySelector(
                '.update-monitor-list'
            );

            if (!list) return;

            const items = Array.from(
                list.querySelectorAll('.update-entry')
            );

            if (
                !items.length ||
                items.length === lastCount
            ) {
                return;
            }

            if (!cachedEntries) {
                cachedEntries = await loadEntries();
            }

            if (!cachedEntries.length) return;

            let visibleEntries = cachedEntries;

            try {
                const clearAt = Number(
                    localStorage.getItem(
                        'ietsh-lmd-update-cleared-at'
                    )
                ) || 0;

                if (clearAt) {
                    visibleEntries = cachedEntries.filter(
                        entry => {
                            const time = new Date(
                                entry.time
                            ).getTime();

                            return (
                                Number.isNaN(time) ||
                                time > clearAt
                            );
                        }
                    );
                }
            } catch (error) {
                visibleEntries = cachedEntries;
            }

            const entriesById = new Map(
                visibleEntries.map(
                    entry => [
                        String(entry.id),
                        entry
                    ]
                )
            );

            items.forEach(item => {
                if (
                    item.querySelector(
                        '.update-entry-change'
                    )
                ) {
                    return;
                }

                const entryId =
                    item.getAttribute(
                        'data-update-id'
                    );

                if (!entryId) return;

                const entry =
                    entriesById.get(
                        String(entryId)
                    );

                if (!entry) return;

                const type =
                    String(entry.type || '');

                if (
                    type === 'Author Rating Changed'
                ) {
                    const current =
                        entry.current;

                    const change =
                        document.createElement(
                            'div'
                        );

                    change.className =
                        'update-entry-note';

                    change.textContent =
                        current === false
                            ? 'Rating is now based on solvers\' ratings.'
                            : 'Rating is now based on the author\'s rating.';

                    item.appendChild(
                        change
                    );

                    return;
                }

                if (
                    !detailedTypes.has(type)
                ) {
                    return;
                }

                if (
                    entry.previous === undefined ||
                    entry.current === undefined
                ) {
                    return;
                }

                const change =
                    document.createElement(
                        'div'
                    );

                change.className =
                    'update-entry-change';

                const previousWrap =
                    document.createElement(
                        'div'
                    );

                previousWrap.className =
                    'update-entry-side';

                const previousLabel =
                    document.createElement(
                        'span'
                    );

                previousLabel.className =
                    'update-entry-side-label';

                previousLabel.textContent =
                    'FROM';

                const previous =
                    document.createElement(
                        'div'
                    );

                previous.className =
                    'update-entry-value previous';

                previous.textContent =
                    formatValue(
                        entry.previous,
                        entry.field
                    );

                previousWrap.append(
                    previousLabel,
                    previous
                );

                const arrow =
                    document.createElement(
                        'div'
                    );

                arrow.className =
                    'update-entry-arrow';

                arrow.textContent =
                    '→';

                arrow.setAttribute(
                    'aria-hidden',
                    'true'
                );

                const currentWrap =
                    document.createElement(
                        'div'
                    );

                currentWrap.className =
                    'update-entry-side';

                const currentLabel =
                    document.createElement(
                        'span'
                    );

                currentLabel.className =
                    'update-entry-side-label';

                currentLabel.textContent =
                    'TO';

                const current =
                    document.createElement(
                        'div'
                    );

                current.className =
                    'update-entry-value current';

                current.textContent =
                    formatValue(
                        entry.current,
                        entry.field
                    );

                currentWrap.append(
                    currentLabel,
                    current
                );

                change.append(
                    previousWrap,
                    arrow,
                    currentWrap
                );

                item.appendChild(
                    change
                );
            });

            lastCount = items.length;
        };

        const observer =
            new MutationObserver(() => {
                applyDetails();
            });

        const start = () => {
            const dashboard =
                document.querySelector(
                    '#puzzle-dashboard'
                );

            if (!dashboard) {
                requestAnimationFrame(
                    start
                );
                return;
            }

            observer.observe(
                dashboard,
                {
                    childList: true,
                    subtree: true
                }
            );

            applyDetails();
        };

        start();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectInteractiveEffects();
            createMouseGlow();
            installUpdateMonitorEnhancement();
        }, { once: true });
    } else {
        injectInteractiveEffects();
        createMouseGlow();
        installUpdateMonitorEnhancement();
    }

    return { drawStarBar };
})();
