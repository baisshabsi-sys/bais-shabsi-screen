/* Bais Shabsi — last-Mincha countdown (v4, live since 2026-11-15).
 *
 * Loaded after app.js. Last weekday Mincha = the latest time in the screen's
 * own weekday Mincha row (buildSchedule().wk.mincha), not hardcoded.
 * Uses existing screen globals: now, todayYMD, addDays, zmanim, lmins,
 * round5, hm. Overlay only — does not change the weekday grid layout.
 *
 * Behavior (Sun–Thu, last weekday Mincha = latest Sun–Thu shkia, rounded
 * up to 5 minutes, minus 20; this week 4:25):
 *  - Hidden until 5 minutes before last Mincha (4:20).
 *  - From 4:20 until Mincha starts: static. Shows shkia − Mincha start
 *    as mm:ss (Sunday 15:17, Thursday 12:22). Label: "time for Mincha".
 *  - From Mincha start until shkia: live mm:ss countdown to shkia.
 *    Label: "until shkia".
 *  - At shkia, shows 0:00 for 3 seconds, then hides.
 *
 * Color:
 *  - Gold (#e8c45a) normally.
 *  - Red (#ef4444) if the day's Mincha window (shkia − start) is under
 *    15:00, OR if time remaining to shkia is under 3:00.
 *
 * Tie to last Mincha: while visible, a matching gold/red rounded outline
 * glows around the last-Mincha cell (4:25), the badge sits as a callout
 * tab on that cell's left with a caret pointing at it, and the badge
 * English sublabel only ("time for Mincha" / "until shkia").
 */
(function (global) {
  const SHOW_BEFORE_MIN = 5;   // appear this many minutes before last Mincha
  const WINDOW_RED_MIN = 15;   // red if day's window is under this
  const REMAIN_RED_MIN = 3;    // red if countdown remaining is under this
  const ZERO_HOLD_SEC = 3;     // keep 0:00 on screen this long after shkia
  const ID = 'mincha-cd';
  const HL = 'mincha-cd-hl';

  const CSS = `
#${ID}{
  position:absolute;z-index:6;direction:ltr;pointer-events:none;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-width:136px;padding:3px 12px 4px;border-radius:12px;
  background:#0e1a38;border:2px solid #e8c45a;
  box-shadow:0 6px 18px rgba(0,0,0,.4);
  font-family:Rubik,sans-serif;color:#fff7dc;
  box-sizing:border-box;
}
#${ID}.off{display:none}
#${ID}.red{border-color:#ef4444;box-shadow:0 0 16px rgba(239,68,68,.28),0 6px 18px rgba(0,0,0,.4)}
#${ID} .n{
  font-weight:700;font-variant-numeric:tabular-nums lining-nums;
  font-feature-settings:'tnum' 1,'lnum' 1;
  letter-spacing:-1.5px;line-height:1;font-size:42px;color:#e8c45a;
}
#${ID}.red .n{color:#ef4444}
#${ID} .en{
  margin-top:2px;font-size:13px;font-weight:600;letter-spacing:.2px;
  color:#c9d3e6;text-transform:none;
}
#${ID}.red .en{color:#fca5a5}
#${ID} .ptr{
  position:absolute;right:-8px;top:50%;width:14px;height:14px;
  background:#0e1a38;border-right:2px solid #e8c45a;border-top:2px solid #e8c45a;
  transform:translateY(-50%) rotate(45deg);z-index:7;
  box-sizing:border-box;
}
#${ID}.red .ptr{border-right-color:#ef4444;border-top-color:#ef4444}
#${HL}{
  position:absolute;z-index:5;pointer-events:none;box-sizing:border-box;
  border-radius:12px;border:3px solid #e8c45a;
  box-shadow:0 0 16px rgba(232,196,90,.55), inset 0 0 10px rgba(232,196,90,.12);
}
#${HL}.off{display:none}
#${HL}.red{
  border-color:#ef4444;
  box-shadow:0 0 16px rgba(239,68,68,.5), inset 0 0 10px rgba(239,68,68,.12);
}
`;

  function ensureStyle() {
    if (document.getElementById(ID + '-css')) return;
    const s = document.createElement('style');
    s.id = ID + '-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function fmtMMSS(minutes) {
    const sec = Math.max(0, Math.round(minutes * 60));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function lateMinchaAndShkia(n) {
    if (typeof state === 'undefined' || !state || !state.api || typeof buildSchedule !== 'function') return null;
    const t = todayYMD(n);
    const dow = new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay();
    if (dow > 4) return null; // Sun–Thu only; never Fri/Shabbos
    const b = document.body.classList;
    if (b.contains('shabbos') || b.contains('graphic') || b.contains('candles')) return null;
    const S = buildSchedule(state.api, t);
    const list = (S.wk && S.wk.mincha || []).filter(function (v) { return v != null; });
    if (!list.length) return null;
    const mincha = Math.max.apply(null, list);
    const shkia = lmins(zmanim(t.y, t.m, t.d).sunset);
    if (!(shkia > mincha)) return null; // not a before-shkia Mincha layout
    return { t, dow, mincha, shkia, window: shkia - mincha };
  }

  function stateAt(n) {
    const rec = lateMinchaAndShkia(n);
    if (!rec) return { show: false };
    const nowMin = lmins(n.getTime());
    const showAt = rec.mincha - SHOW_BEFORE_MIN;
    const remain = rec.shkia - nowMin;
    const afterShkiaSec = (nowMin - rec.shkia) * 60;
    if (nowMin < showAt) return { show: false, rec, nowMin };
    if (afterShkiaSec > ZERO_HOLD_SEC) return { show: false, rec, nowMin, remain };

    const started = nowMin >= rec.mincha;
    const atOrPastShkia = nowMin >= rec.shkia;
    const display = atOrPastShkia ? '0:00' : fmtMMSS(started ? remain : rec.window);
    const mode = !started ? 'static' : (atOrPastShkia ? 'zero' : 'countdown');
    const red = rec.window < WINDOW_RED_MIN || remain < REMAIN_RED_MIN || atOrPastShkia;
    const minchaText = (typeof hm === 'function') ? hm(rec.mincha) : '4:25';
    return {
      show: true, rec, nowMin, remain, started, atOrPastShkia, display, mode, red,
      minchaText,
      en: started ? 'until shkia' : 'time for Mincha',
    };
  }

  function el(id) { return document.getElementById(id || ID); }

  function ensureEl() {
    ensureStyle();
    let node = el(ID);
    if (!node) {
      node = document.createElement('div');
      node.id = ID;
      node.className = 'off';
      node.setAttribute('dir', 'ltr');
      node.setAttribute('aria-live', 'polite');
      node.innerHTML = '<div class="n"></div><div class="en"></div>'
        + '<div class="ptr" aria-hidden="true"></div>';
    }
    let hl = el(HL);
    if (!hl) {
      hl = document.createElement('div');
      hl.id = HL;
      hl.className = 'off';
      hl.setAttribute('aria-hidden', 'true');
    }
    const host = document.getElementById('wksec') || document.getElementById('stage') || document.body;
    if (node.parentNode !== host) host.appendChild(node);
    if (hl.parentNode !== host) host.appendChild(hl);
    return node;
  }

  function findLastMinchaCell(minchaMin) {
    const grid = document.getElementById('weekday');
    if (!grid) return null;
    const lbl = [...grid.querySelectorAll(':scope > .lbl')].find(function (e) {
      return e.textContent.indexOf('מנחה') !== -1;
    });
    if (!lbl) return null;
    const cells = [];
    let n = lbl.nextElementSibling;
    while (n && !n.classList.contains('lbl')) {
      if (n.classList.contains('cell')) cells.push(n);
      n = n.nextElementSibling;
    }
    const want = (typeof hm === 'function') ? hm(minchaMin) : null;
    return want ? cells.find(function (c) {
      return c.textContent.replace(/\s/g, '').indexOf(want) === 0;
    }) || null : null;
  }

  function glyphBox(cell) {
    const r = document.createRange();
    let found = false;
    cell.childNodes.forEach(function (n) {
      if (n.nodeType !== 3) return;
      const t = n.textContent;
      if (!t || !t.trim()) return;
      const a = t.search(/\S/), b = t.search(/\s*$/);
      if (!found) { r.setStart(n, a < 0 ? 0 : a); found = true; }
      r.setEnd(n, b < 0 ? t.length : b);
    });
    return found ? r.getBoundingClientRect() : cell.getBoundingClientRect();
  }

  function place(node, minchaMin) {
    const wk = document.getElementById('wksec');
    const cell = findLastMinchaCell(minchaMin);
    const hl = el(HL);
    if (!wk || !cell) return;
    if (node.parentNode !== wk) wk.appendChild(node);
    if (hl && hl.parentNode !== wk) wk.appendChild(hl);
    const wr = wk.getBoundingClientRect();
    const gb = glyphBox(cell);
    const stage = document.getElementById('stage');
    const scale = stage ? (stage.getBoundingClientRect().width / 1920) : 1;
    const gx = (gb.left - wr.left) / scale;
    const gy = (gb.top - wr.top) / scale;
    const gw = gb.width / scale, gh = gb.height / scale;
    const padX = 12, padY = 8;
    if (hl) {
      hl.style.left = (gx - padX) + 'px';
      hl.style.top = (gy - padY) + 'px';
      hl.style.width = (gw + padX * 2) + 'px';
      hl.style.height = (gh + padY * 2) + 'px';
    }
    // Attach the badge as a callout on the left of the 4:25 outline, caret touching it.
    const bw = node.offsetWidth, bh = node.offsetHeight;
    const hlLeft = gx - padX;
    const hlTop = gy - padY, hlH = gh + padY * 2;
    const caret = 8; // .ptr extends ~8px past the badge's right edge
    let left = hlLeft - bw - caret + 2;
    if (left < 12) left = 12;
    // Vertically center on the 4:25 glyph / highlight, but stay in the Mincha row.
    const cr = cell.getBoundingClientRect();
    const rowTop = (cr.top - wr.top) / scale;
    const rowH = cr.height / scale;
    let top = hlTop + (hlH - bh) / 2;
    if (top + bh > rowTop + rowH - 2) top = Math.max(rowTop, rowTop + rowH - bh - 2);
    if (top < rowTop) top = rowTop;
    node.style.left = left + 'px';
    node.style.top = top + 'px';
  }

  function hideChrome(node) {
    node.classList.add('off');
    node.setAttribute('aria-hidden', 'true');
    const hl = el(HL);
    if (hl) {
      hl.classList.add('off');
      hl.setAttribute('aria-hidden', 'true');
    }
  }

  function update() {
    if (typeof now !== 'function' || typeof zmanim !== 'function') return null;
    let st = stateAt(now());
    const node = ensureEl();
    const hl = el(HL);
    if (st.show) {
      const cell = findLastMinchaCell(st.rec.mincha);
      const grid = document.getElementById('weekday');
      const gs = grid && getComputedStyle(grid);
      if (!cell || !gs || gs.visibility === 'hidden' || gs.display === 'none' || cell.offsetParent === null) st = { show: false };
    }
    if (!st.show) {
      hideChrome(node);
      return st;
    }
    node.classList.remove('off');
    node.classList.toggle('red', !!st.red);
    node.setAttribute('aria-hidden', 'false');
    node.querySelector('.n').textContent = st.display;
    node.querySelector('.en').textContent = st.en;
    if (hl) {
      hl.classList.remove('off');
      hl.classList.toggle('red', !!st.red);
      hl.setAttribute('aria-hidden', 'false');
    }
    place(node, st.rec.mincha);
    return st;
  }

  function hookRender() {
    if (typeof render !== 'function' || render.__minchaCd) return;
    const orig = render;
    function wrapped() {
      orig.apply(this, arguments);
      try { update(); } catch (e) { console.error('mincha-cd', e); }
    }
    wrapped.__minchaCd = true;
    render = wrapped;
  }

  function start() {
    ensureStyle();
    hookRender();
    try { update(); } catch (e) { console.error('mincha-cd', e); }
    if (!start._tick) start._tick = setInterval(function () {
      try { update(); } catch (e) { console.error('mincha-cd', e); }
    }, 250);
  }

  global.MinchaCountdown = {
    update, stateAt, lateMinchaAndShkia, fmtMMSS, start,
    WINDOW_RED_MIN, REMAIN_RED_MIN, SHOW_BEFORE_MIN, ZERO_HOLD_SEC,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof window !== 'undefined' ? window : this);
