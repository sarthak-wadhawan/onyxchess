// Keep the homepage animation independent of shared navigation.
(() => {
    // Homepage only: title reveal, scroll transition and cursor-driven chess pieces.
    const hero = document.querySelector('.onyx-intro');
    const wordmark = hero.querySelector('.hero-wordmark');
    const description = hero.querySelector('.hero-description');
    const title = document.querySelector('#wordmark');
    const titleDefs = document.querySelector('#title-defs');
    const fragments = document.querySelector('#title-reveal');
    const header = document.querySelector('.home-header');
    const logo = header.querySelector('.brand img');
    const menu = header.querySelector('.course-menu');
    const trailLayer = hero.querySelector('.cursor-trail');
    const trailGroup = document.querySelector('#trail-pieces');
    const button = hero.querySelector('.motion-button');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const svgNS = 'http://www.w3.org/2000/svg';

    function svg(tag, attributes = {}) {
        const element = document.createElementNS(svgNS, tag);
        for (const [name, value] of Object.entries(attributes)) {
            element.setAttribute(name, value);
        }
        return element;
    }

    function clamp(value) { return Math.max(0, Math.min(1, value)); }
    function ease(value) { const p = clamp(value); return p * p * (3 - 2 * p); }
    function lerp(start, end, progress) { return start + (end - start) * progress; }

    // 1. Reveal the text in slices once per page load, never on pause or scroll.
    function finishReveal() {
        title.style.visibility = 'visible';
        fragments.replaceChildren();
        titleDefs.replaceChildren();
    }

    function revealTitle() {
        const bounds = title.getBBox();
        const columns = 10;
        const rows = 3;
        const width = (bounds.width + 4) / columns;
        const height = (bounds.height + 4) / rows;
        const source = title.cloneNode(true);
        source.id = 'title-source';
        titleDefs.append(source);
        title.style.visibility = 'hidden';

        for (let column = 0; column < columns; column++) {
            for (let row = 0; row < rows; row++) {
                const id = `title-mask-${column}-${row}`;
                const mask = svg('clipPath', { id });
                mask.append(svg('rect', {
                    x: bounds.x - 2 + column * width,
                    y: bounds.y - 2 + row * height,
                    width: width + .15,
                    height: height + .15
                }));
                titleDefs.append(mask);
                const group = svg('g', { 'clip-path': `url(#${id})` });
                const slice = svg('use', { href: '#title-source', class: 'title-fragment' });
                slice.style.setProperty('--delay', `${40 + column * 67 + (2 - row) * 115}ms`);
                slice.style.setProperty('--from-x', `${row === 1 ? -15 : 0}px`);
                slice.style.setProperty('--from-y', `${row === 0 ? -110 : 110}px`);
                group.append(slice);
                fragments.append(group);
            }
        }
        // Restore the original text after the reveal to eliminate slice seams.
        setTimeout(finishReveal, 1650);
    }

    // 2. The scroll position is the animation timeline. Scrolling back reverses it.
    let scrollProgress = 0;
    let scrollFrame = 0;
    let heroVisible = true;
    wordmark.classList.add('is-animated');
    header.classList.add('is-animated');

    function updateScroll() {
        scrollFrame = 0;
        const heroHeight = hero.offsetHeight;
        // Complete the transition before the lesson list can overlap the title.
        const distance = Math.max(1, Math.min(heroHeight * .78, document.documentElement.scrollHeight - innerHeight));
        scrollProgress = clamp(window.scrollY / distance);
        const progress = scrollProgress;
        if (description) {
            description.style.opacity = 1 - ease(progress / .18);
        }
        const logoBox = logo.getBoundingClientRect();
        const x = lerp(innerWidth / 2, logoBox.left + logoBox.width / 2, progress);
        const y = lerp(heroHeight / 2, logoBox.top + logoBox.height / 2, progress);
        const finalScale = Math.min(1, 54 / (wordmark.offsetWidth * .79));
        const scale = lerp(1, finalScale, progress);
        const morph = ease((progress - .72) / .28);
        const headerOpacity = ease((progress - .12) / .5);
        wordmark.style.left = `${x}px`;
        wordmark.style.top = `${y}px`;
        wordmark.style.transform = `translate(-50%, -50%) scale(${scale})`;
        wordmark.style.opacity = 1 - morph;
        wordmark.style.visibility = morph === 1 ? 'hidden' : 'visible';
        header.style.opacity = headerOpacity;
        logo.style.opacity = morph;
        header.inert = headerOpacity < .99;
        if (header.inert) menu.open = false;
        // Never draw pieces in the tutorial or around the compact header logo.
        heroVisible = scrollProgress <= .01;
        if (!heroVisible) clearTrail();
        trailLayer.style.visibility = heroVisible ? 'visible' : 'hidden';
        button.style.opacity = 1 - ease(scrollProgress / .12);
        button.inert = scrollProgress > .01;
    }
    function scheduleScroll() {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
    }
    window.addEventListener('scroll', scheduleScroll, { passive: true });
    window.addEventListener('resize', scheduleScroll);

    // 3. A finite trail of chess pieces follows the actual pointer. No idle orbit.
    const pieceTypes = ['knight', 'pawn', 'rook', 'bishop', 'queen', 'king'];
    const colors = ['#08408d', '#f4f5ec', '#151515'];
    const spacing = 36;
    const pieces = Array.from({ length: 24 }, (_, i) => {
        const fill = colors[i % colors.length];
        const outline = fill === '#f4f5ec' ? '#151515' : '#f4f5ec';
        const piece = svg('use', {
            href: '#' + pieceTypes[i % pieceTypes.length],
            class: 'orbit-piece', fill, stroke: outline, opacity: 0
        });
        piece.style.setProperty('--detail', outline);
        trailGroup.append(piece);
        return piece;
    });
    let playing = true;
    let pointer = null;
    let head = null;
    let points = [];
    let trailFrame = 0;
    let previousTime = 0;

    function clearTrail() {
        cancelAnimationFrame(trailFrame);
        trailFrame = 0;
        pointer = null;
        head = null;
        points = [];
        previousTime = 0;
        for (const piece of pieces) piece.setAttribute('opacity', 0);
    }

    function recordPoint(point) {
        if (!points.length || Math.hypot(point.x - points[0].x, point.y - points[0].y) >= 2) {
            points.unshift({ ...point });
        }
        // Keep only enough path history for the visible ribbon.
        let distance = 0;
        for (let i = 1; i < points.length; i++) {
            distance += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
            if (distance > spacing * (pieces.length + 2)) {
                points.length = i + 1;
                break;
            }
        }
        if (points.length > 1200) points.length = 1200;
    }

    function drawTrail() {
        recordPoint(head);
        const path = [head, ...points];
        let segment = 1;
        let distance = 0;
        pieces.forEach((piece, i) => {
            const target = 32 + i * spacing;
            while (segment < path.length) {
                const a = path[segment - 1];
                const b = path[segment];
                const length = Math.hypot(b.x - a.x, b.y - a.y);
                if (length > 0 && distance + length >= target) {
                    const fraction = (target - distance) / length;
                    const x = lerp(a.x, b.x, fraction);
                    const y = lerp(a.y, b.y, fraction);
                    const scale = 1.05 - i * .012;
                    piece.setAttribute('transform', `translate(${x} ${y}) rotate(${Math.sin(i * 1.8) * 12}) scale(${scale})`);
                    piece.setAttribute('opacity', Math.max(.2, 1 - i * .034));
                    return;
                }
                distance += length;
                segment++;
            }
            piece.setAttribute('opacity', 0);
        });
    }

    function animateTrail(time) {
        trailFrame = 0;
        if (!playing || !heroVisible || !head || !pointer) return;
        const delta = previousTime ? Math.min(time - previousTime, 50) : 16;
        previousTime = time;
        const factor = 1 - Math.exp(-delta / 42);
        head.x += (pointer.x - head.x) * factor;
        head.y += (pointer.y - head.y) * factor;
        drawTrail();
        if (Math.hypot(pointer.x - head.x, pointer.y - head.y) > .3) {
            trailFrame = requestAnimationFrame(animateTrail);
        } else {
            previousTime = 0;
        }
    }

    hero.addEventListener('pointermove', event => {
        if (!playing || !heroVisible || !finePointer.matches || event.pointerType === 'touch' || event.target.closest('.motion-button')) return;
        const rect = hero.getBoundingClientRect();
        pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        if (!head) head = { ...pointer };
        if (!trailFrame) trailFrame = requestAnimationFrame(animateTrail);
    });
    hero.addEventListener('pointerleave', clearTrail);
    window.addEventListener('blur', clearTrail);

    function setPlaying(value) {
        playing = value;
        cancelAnimationFrame(trailFrame);
        trailFrame = 0;
        previousTime = 0;
        button.textContent = playing ? 'Ⅱ' : '▶';
        button.setAttribute('aria-label', playing ? 'Pause chess pieces' : 'Resume chess pieces');
        button.setAttribute('aria-pressed', String(!playing));
        // Resume from a clean trail rather than connecting across a paused movement.
        if (playing) clearTrail();
    }
    button.addEventListener('click', () => setPlaying(!playing));
    function updateMotionPreference() {
        button.hidden = !finePointer.matches;
        clearTrail();
        scheduleScroll();
    }
    finePointer.addEventListener('change', updateMotionPreference);
    button.hidden = !finePointer.matches;
    setPlaying(playing);
    updateScroll();
    // Always initialize the reveal on a fresh page load.
    revealTitle();
})();
