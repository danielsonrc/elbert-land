// Phone layout: the booking panel is a bottom sheet. Pull it up to cover the 3D view, back down
// to half height, or pull it away to return to the meadow. Like the native sheets on iOS and
// Android, a pull on the content moves the sheet first and scrolls only once it is fully open.

const SLOP = 6; // px a touch travels before the sheet starts to follow it
const FLICK = 0.45; // release speed in px/ms that counts as a flick
const SAMPLE_MS = 90; // how much of the end of a drag the release speed is measured over

/**
 * @param {HTMLElement} panel the booking panel
 * @param {{ active: () => boolean, onDismiss: () => void }} options
 *   `active` says whether the panel is showing as a sheet right now; `onDismiss` closes the stay.
 */
export function createSheet(panel, { active, onDismiss }) {
  const scroller = panel.querySelector('.panel__scroll');
  const grab = panel.querySelector('.panel__grab');
  // Resolves the CSS sheet sizes (dvh and safe-area values) to pixels.
  const probe = document.createElement('div');
  probe.className = 'panel__probe';
  panel.append(probe);
  const measure = (size) => {
    probe.style.height = `var(${size})`;
    return probe.getBoundingClientRect().height;
  };

  let expanded = false;
  let drag = null;
  let swallowClicksUntil = 0;

  function setExpanded(on) {
    expanded = on;
    panel.classList.toggle('is-expanded', on);
    grab.setAttribute('aria-expanded', String(on));
    grab.setAttribute('aria-label', on ? 'Shrink booking panel' : 'Expand booking panel');
  }

  /** Hand the sheet back to CSS, which animates it to its resting place. */
  function release() {
    panel.classList.remove('is-dragging');
    panel.style.height = '';
    panel.style.transform = '';
  }

  /** Put the top of the sheet `top` px above the bottom of the screen. */
  function place(top) {
    const { half } = drag;
    if (top >= half) {
      panel.style.height = `${top}px`;
      panel.style.transform = 'none';
    } else {
      // below half height the sheet slides down rather than shrinking
      panel.style.height = `${half}px`;
      panel.style.transform = `translateY(${half - Math.max(0, top)}px)`;
    }
  }

  function start(x, y, fromGrab) {
    drag = {
      x0: x, y0: y, fromGrab, claimed: fromGrab, moving: false,
      top0: innerHeight - panel.getBoundingClientRect().top,
      half: measure('--sheet-half'),
      full: measure('--sheet-full'),
      scroll0: scroller.scrollTop,
      samples: [{ y, t: performance.now() }],
    };
  }

  function follow(y) {
    const now = performance.now();
    drag.samples.push({ y, t: now });
    while (drag.samples.length > 2 && now - drag.samples[0].t > SAMPLE_MS) drag.samples.shift();
    if (!drag.moving) {
      if (Math.abs(y - drag.y0) < SLOP) return;
      drag.moving = true;
      drag.y0 = y;
      panel.classList.add('is-dragging');
    }
    let top = drag.top0 - (y - drag.y0);
    if (top > drag.full) {
      // fully open: the rest of a pull on the content scrolls it
      if (!drag.fromGrab) scroller.scrollTop = drag.scroll0 + (top - drag.full);
      top = drag.full;
    }
    place(top);
  }

  function finish() {
    const d = drag;
    drag = null;
    if (!d?.moving) return;
    swallowClicksUntil = performance.now() + 350;
    const first = d.samples[0], last = d.samples[d.samples.length - 1];
    const speed = (last.y - first.y) / Math.max(1, last.t - first.t); // positive is downward
    const top = innerHeight - panel.getBoundingClientRect().top;
    let to;
    if (speed > FLICK) to = d.top0 > d.half + 24 && top > d.half * 0.5 ? 'half' : 'away';
    else if (speed < -FLICK) to = 'full';
    else if (top < d.half * 0.6) to = 'away';
    else to = top > (d.half + d.full) / 2 ? 'full' : 'half';
    release();
    setExpanded(to === 'full');
    if (to === 'away') onDismiss();
  }

  // Touch: pulls on the handle always move the sheet; pulls on the content move it only
  // when the content has nothing to scroll in that direction.
  panel.addEventListener('touchstart', (e) => {
    drag = null;
    if (!active() || e.touches.length !== 1) return;
    const t = e.touches[0];
    start(t.clientX, t.clientY, Boolean(e.target.closest('.panel__grab')));
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    if (!drag) return;
    if (e.touches.length !== 1) return finish();
    const t = e.touches[0];
    if (!drag.claimed) {
      const dx = t.clientX - drag.x0, dy = t.clientY - drag.y0;
      if (!dx && !dy) return;
      const up = dy < 0;
      if (Math.abs(dx) > Math.abs(dy) || (up ? expanded : scroller.scrollTop > 0)) {
        drag = null; // sideways, or the content scrolls
        return;
      }
      drag.claimed = true;
    }
    // decided on the first move, so the browser never starts scrolling underneath
    if (e.cancelable) e.preventDefault();
    follow(t.clientY);
  }, { passive: false });

  panel.addEventListener('touchend', finish);
  panel.addEventListener('touchcancel', finish);

  // Mouse: the handle drags in a narrow desktop window too.
  grab.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !active()) return;
    grab.setPointerCapture(e.pointerId);
    start(e.clientX, e.clientY, true);
  });
  grab.addEventListener('pointermove', (e) => {
    if (drag && e.pointerType === 'mouse') follow(e.clientY);
  });
  grab.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') finish();
  });

  // A drag that ends over a button, date or photo shouldn't also press it.
  panel.addEventListener('click', (e) => {
    if (performance.now() < swallowClicksUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // A tap (or Enter) on the handle switches between half and full height.
  grab.addEventListener('click', () => setExpanded(!expanded));

  return {
    /** Back to half height with nothing mid-drag, e.g. when the stay closes. */
    reset() {
      drag = null;
      release();
      setExpanded(false);
    },
  };
}
