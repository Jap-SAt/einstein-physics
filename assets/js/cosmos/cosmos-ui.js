/* ════════════════ cosmos-ui: dock, HUD, คำบรรยาย, ป้ายกำกับ ════════════════
   Pure DOM. Knows nothing about Three.js or audio: the controller feeds it state through
   update() and receives intent through handlers. Keyboard shortcuts belong to the controller. */
const CosmosUI = (() => {
  'use strict';
  const P = CosmosPhysics;
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const EXPERT_DELAY_MS = 2000;

  /** compact tick label: "0", "10⁻¹² s", then the normal Thai units */
  function tickLabel(t) {
    if (t <= P.CONST.T_START * 1.0001) return '0';
    if (t < 1) return '10' + String(Math.round(Math.log10(t))).replace(/./g, c => SUP[c] || c) + ' s';
    return P.formatTime(t);
  }
  const scaleText = a => (a >= 0.01 ? a.toFixed(a >= 0.995 ? 2 : 3) : P.formatSci(a));

  function el(tag, cls, attrs, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function create(handlers) {
    const H = Object.assign({ onScrub() {}, onScrubEnd() {}, onPlayToggle() {}, onSpeed() {}, onToggleGrid() {}, onToggleLabels() {}, onToggleSound() {}, onPrevEra() {}, onNextEra() {}, onClose() {} }, handlers);
    const root = el('div', 'cc', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'กำเนิดจักรวาล — จากบิกแบงถึงสิ่งมีชีวิต' });
    const stage = el('div', 'cc-stage'); root.appendChild(stage);
    const labelLayer = el('div', 'cc-labels', { 'aria-hidden': 'true' }); root.appendChild(labelLayer);

    /* HUD (top-right) */
    const hud = el('div', 'cc-hud');
    const row = (k, key) => { const r = el('div', 'cc-hud-row'); r.appendChild(el('span', 'cc-hud-k', null, k)); const v = el('span', 'cc-hud-v mono', { 'data-hud': key }); r.appendChild(v); hud.appendChild(r); return v; };
    const hTime = row('เวลา', 'time'), hTemp = row('อุณหภูมิ', 'temp'), hScale = row('ขนาด a', 'scale');
    const hNote = el('div', 'cc-hud-note', { 'data-hud': 'note', hidden: '' }, 'ช่วงนี้ a และ T เป็นค่าโดยประมาณตามแบบจำลองการพองตัว (ยังไม่มีการวัดยืนยัน)');
    hud.appendChild(hNote);
    const hEra = el('div', 'cc-hud-era'); hud.appendChild(hEra);
    root.appendChild(hud);

    /* cinematic captions (lower-left) */
    const cap = el('div', 'cc-cap');
    const bigTime = el('div', 'cc-bigtime mono', { 'data-hud': 'bigtime' });
    const capTitle = el('div', 'cc-cap-title'), capText = el('div', 'cc-cap-text', { 'aria-live': 'polite' });
    const expert = el('div', 'cc-expert'); expert.appendChild(el('div', 'cc-expert-k', null, 'มุมผู้เชี่ยวชาญ')); const expertText = el('div', 'cc-expert-v'); expert.appendChild(expertText);
    cap.append(bigTime, capTitle, capText, expert);
    root.appendChild(cap);

    /* dock */
    const dock = el('div', 'cc-dock');
    const btn = (act, label, text, cls) => { const b = el('button', 'cc-btn' + (cls ? ' ' + cls : ''), { type: 'button', 'data-act': act, 'aria-label': label, title: label }, text); return b; };
    const left = el('div', 'cc-group');
    const bPlay = btn('play', 'เล่น/หยุด (Space)', '❚❚', 'cc-play'), bPrev = btn('prev', 'ยุคก่อนหน้า (←)', '‹'), bNext = btn('next', 'ยุคถัดไป (→)', '›');
    left.append(bPrev, bPlay, bNext);

    const tl = el('div', 'cc-timeline');
    const range = el('input', 'cc-range', { type: 'range', min: '0', max: '1', step: '0.0001', value: '0', 'aria-label': 'เวลาหลังบิกแบง' });
    const ticks = el('div', 'cc-ticks', { 'aria-hidden': 'true' });
    let cum = 0;
    for (const e of P.ERAS) {
      const tk = el('div', 'cc-tick' + (e.kind === 'main' ? ' main' : ''), { title: e.title + ' · ' + P.formatTime(e.start) });
      tk.style.left = (cum * 100) + '%';
      if (e.kind === 'main') tk.appendChild(el('span', 'cc-tick-l mono', null, tickLabel(e.start)));
      ticks.appendChild(tk); cum += e.width;
    }
    tl.append(range, ticks, el('div', 'cc-note', null, 'สเกลเวลาแบบลอการิทึมแบ่งช่วง'));

    const speeds = el('div', 'cc-seg', { role: 'group', 'aria-label': 'ความเร็ว' });
    const speedBtns = [1, 2, 5].map(n => { const b = el('button', 'cc-seg-b', { type: 'button', 'data-speed': String(n), 'aria-pressed': n === 1 ? 'true' : 'false' }, n + '×'); speeds.appendChild(b); return b; });
    const right = el('div', 'cc-group');
    const bGrid = btn('grid', 'กริดกาลอวกาศ', 'กริด'), bLabels = btn('labels', 'ป้ายกำกับอนุภาค', 'ป้าย'), bSound = btn('sound', 'เสียง', 'เสียง'), bClose = btn('close', 'ปิด (Esc)', '✕', 'cc-close');
    [bGrid, bLabels].forEach(b => b.setAttribute('aria-pressed', 'false'));
    right.append(bGrid, bLabels, bSound, bClose);
    dock.append(left, tl, speeds, right);
    root.appendChild(dock);

    /* events */
    let dragging = false, gridOn = false, labelsOn = false;
    const onInput = () => { dragging = true; H.onScrub(parseFloat(range.value)); };
    const onChange = () => { if (dragging) { dragging = false; H.onScrubEnd(); } };
    range.addEventListener('input', onInput);
    range.addEventListener('change', onChange);
    range.addEventListener('pointerup', onChange);
    const onClick = e => {
      const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
      if (b.dataset.speed) { H.onSpeed(+b.dataset.speed); return; }
      switch (b.dataset.act) {
        case 'play': H.onPlayToggle(); break;
        case 'prev': H.onPrevEra(); break;
        case 'next': H.onNextEra(); break;
        case 'grid': ui.setGrid(!gridOn); H.onToggleGrid(gridOn); break;
        case 'labels': ui.setLabelsOn(!labelsOn); H.onToggleLabels(labelsOn); break;
        case 'sound': H.onToggleSound(); break;
        case 'close': H.onClose(); break;
      }
    };
    dock.addEventListener('click', onClick);

    /* write-on-change helpers */
    const cache = new Map();
    const setText = (node, text) => { if (cache.get(node) !== text) { cache.set(node, text); node.textContent = text; } };
    const setAttr = (node, name, v) => { if (node.getAttribute(name) !== v) node.setAttribute(name, v); };
    const setCls = (node, name, on) => { if (node.classList.contains(name) !== on) node.classList.toggle(name, on); };

    let expertTimer = 0, eraShown = null, lastEraAt = -1e9, fades = [];
    const QUICK_MS = 500, FADE_OUT_MS = 280, FADE_IN_MS = 1000;
    const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const pool = [];

    const ui = {
      root, stage,
      update(s) {
        const time = P.formatTime(s.t);
        setText(hTime, time); setText(bigTime, time);
        setText(hTemp, (s.tempApprox ? '≈ ' : '') + P.formatSci(s.tempK) + ' K');
        setText(hScale, (s.modelDependent ? '≈ ' : '') + scaleText(s.scale));
        if (hNote.hidden === !!s.modelDependent) hNote.hidden = !s.modelDependent;
        if (!dragging && Math.abs(parseFloat(range.value) - s.u) > 5e-5) range.value = String(s.u);   // property, not an attribute
        setText(bPlay, s.playing ? '❚❚' : '▶');
        setAttr(bPlay, 'aria-pressed', s.playing ? 'true' : 'false');
        speedBtns.forEach(b => setAttr(b, 'aria-pressed', +b.dataset.speed === s.speed ? 'true' : 'false'));
        setText(bSound, s.soundSuspended && !s.muted ? 'แตะเพื่อเปิดเสียง' : s.muted ? 'เสียง: ปิด' : 'เสียง: เปิด');
        setCls(bSound, 'cc-attn', !!(s.soundSuspended && !s.muted));
        setAttr(bSound, 'aria-pressed', s.muted ? 'false' : 'true');
      },
      showEra(era) {
        if (!era || era === eraShown) return;
        const first = !eraShown, now = performance.now(), quick = now - lastEraAt < QUICK_MS;   // scrubbing: swap, don't animate
        eraShown = era; lastEraAt = now;
        clearTimeout(expertTimer);
        setText(hEra, era.title);
        cap.classList.remove('expert-on');                            // old fact fades out with its own text
        const swap = () => { setText(capTitle, era.title); setText(capText, era.text); };
        fades.forEach(a => a.cancel()); fades = [];
        if (first || quick || reduced() || !capTitle.animate) { swap(); cap.classList.add('show'); }
        else {
          const out = [capTitle, capText].map(n => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT_MS, fill: 'forwards' }));
          fades = out;
          out[0].onfinish = () => {
            if (eraShown !== era) return;
            swap();
            fades = [capTitle, capText].map(n => n.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: FADE_IN_MS, easing: 'ease-out' }));
            out.forEach(a => a.cancel());
          };
        }
        if (era.fact) {
          expertTimer = setTimeout(() => { setText(expertText, era.fact); cap.classList.add('expert-on'); }, EXPERT_DELAY_MS);
        }
      },
      setLabels(anchors) {
        const list = labelsOn ? anchors || [] : [];
        while (pool.length < list.length) { const d = el('div', 'cc-label'); labelLayer.appendChild(d); pool.push(d); }
        pool.forEach((d, i) => {
          const a = list[i];
          if (!a) { if (d.style.display !== 'none') d.style.display = 'none'; return; }
          if (d.style.display === 'none') d.style.display = '';
          setText(d, a.text);
          d.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
        });
      },
      setGrid(on) { gridOn = !!on; setAttr(bGrid, 'aria-pressed', String(gridOn)); },
      setLabelsOn(on) { labelsOn = !!on; setAttr(bLabels, 'aria-pressed', String(labelsOn)); if (!labelsOn) ui.setLabels([]); },
      dispose() {
        clearTimeout(expertTimer);
        fades.forEach(a => a.cancel());
        range.removeEventListener('input', onInput); range.removeEventListener('change', onChange); range.removeEventListener('pointerup', onChange);
        dock.removeEventListener('click', onClick);
        root.remove();
      }
    };
    return ui;
  }

  return { create };
})();
