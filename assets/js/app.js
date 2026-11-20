/* ════════════════ router ════════════════
   #home · #<id> (บทเรียน) · #<id>-sim (การจำลอง) · #<id>-quiz (แบบฝึกหัด; PracticeUI) */
const view = $('#view');
let currentSim = null;
function stopSim() { if (currentSim) { try { currentSim.dispose(); } catch (e) {} currentSim = null; } }

$('#mainnav').innerHTML = MODS.map(m => `<a class="navlink" data-id="${m.id}" href="#${m.id}" title="${m.title}">${m.short}</a>`).join('');

function setFocus(on) { document.body.classList.toggle('focus', on); store.set('focus', on); }
$('#focusBtn').onclick = () => setFocus(!document.body.classList.contains('focus'));
$('#focusExit').onclick = () => setFocus(false);
if (store.get('focus', false)) setFocus(true);

$('#themeBtn').onclick = () => Theme.toggle();
// 3D scenes pick colours when they are built, so rebuild the open view after a theme switch
window.addEventListener('themechange', () => {
  if (typeof Cosmos !== 'undefined' && Cosmos.isOpen()) return;
  const h = location.hash.slice(1);
  if (!h || h === 'home' || h.endsWith('-sim')) route(true);
});

function route(keepScroll) {
  stopSim();
  if (lecObs) { lecObs.disconnect(); lecObs = null; }
  const h = location.hash.slice(1);
  const [id, tab] = h.split('-');
  const m = MODS.find(x => x.id === id);
  document.querySelectorAll('#mainnav a').forEach(a => a.classList.toggle('on', !!(m && a.dataset.id === m.id)));
  $('#readbar').style.width = '0';
  if (keepScroll !== true) window.scrollTo(0, 0);
  const root = document.documentElement.style;
  if (!m) { root.setProperty('--macc', 'var(--ink)'); root.setProperty('--msoft', 'var(--soft)'); return renderHome(); }
  root.setProperty('--macc', m.acc);
  root.setProperty('--msoft', m.soft);
  renderModule(m, tab === 'sim' || tab === 'quiz' ? tab : 'learn');
}
window.addEventListener('hashchange', () => route());

/* ════════════════ home ════════════════ */
function renderHome() {
  const pick = m => {
    const t = PracticeUI.progressText(m.id);
    const badge = `<span class="badge${/^\d/.test(t) ? ' mono' : ''}">${t}</span>`;
    return `<a class="pick compact" href="#${m.id}">
      <span class="ic" style="background:${m.soft};color:${m.acc}">${ICONS[m.id]}</span>
      <span class="flex-1 min-w-0"><span class="t block truncate">${m.title}<span class="en">${m.en}</span></span><span class="s block truncate">${m.sub}</span></span>
      ${badge}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${m.acc}" stroke-width="2" style="flex:none"><path d="m9 6 6 6-6 6"/></svg></a>`;
  };
  const lists = GROUPS.map(g => `<div class="grp">${g.title}<span>${g.en}</span></div>
      <div class="flex flex-col gap-2.5">${MODS.filter(m => m.group === g.id).map(pick).join('')}</div>`).join('');
  view.innerHTML = `
  <section class="wrap hero grid lg:grid-cols-2 gap-14 items-center pt-14 pb-14">
    <div>
      <div class="kicker mb-5">ฟิสิกส์ ม.ปลาย</div>
      <div class="hero-head">
        <h1>เห็นฟิสิกส์<br>ก่อน<span class="soft">จำสูตร</span></h1>
        <button class="atom-btn" id="heroAtom" aria-label="คลิกเพื่อย้อนชมกำเนิดจักรวาล" title="คลิกเพื่อย้อนชมกำเนิดจักรวาล"><span class="atom-tip">คลิกเพื่อย้อนสู่กำเนิดจักรวาล</span></button>
      </div>
      <p class="mt-6 text-[18px] leading-8 max-w-[540px]" style="color:var(--text2)">เริ่มจากกลศาสตร์ ความร้อน และคลื่น แล้วต่อไปถึงอนุภาค คลื่นแม่เหล็กไฟฟ้า อะตอม และนิวเคลียส ผ่านบทเรียนสั้นที่อ่านจบได้ในครั้งเดียว แบบจำลองสามมิติที่หมุน ซูม และปรับค่าได้เอง แล้วฝึกทำโจทย์ทีละระดับด้วยแบบฝึกหัด</p>
      <div class="flex flex-wrap gap-3 mt-8">
        <a class="btn btn-primary" href="#mech">เริ่มบทที่ 1</a>
        <a class="btn btn-ghost" href="#atom-sim">ลองการจำลองอะตอม</a>
      </div>
    </div>
    <div>${lists}</div>
  </section>
  <section class="wrap pb-20">
    <div class="grid md:grid-cols-3 gap-4">
      <div class="step"><div class="n mono">01</div><h3>อ่านให้เข้าใจ</h3><p>เนื้อหาสั้นในคอลัมน์เดียว มีคำอธิบายแบบ Feynman และกล่องตรวจความเข้าใจผิดที่พบบ่อย</p></div>
      <div class="step"><div class="n mono">02</div><h3>ลองด้วยมือ</h3><p>หมุน ซูม และปรับพารามิเตอร์ในแบบจำลอง 3 มิติ ดูตัวเลขที่เปลี่ยนตามแบบเรียลไทม์</p></div>
      <div class="step"><div class="n mono">03</div><h3>ทดสอบตัวเอง</h3><p>โจทย์แนว TPAT3 ทีละข้อ พร้อมเฉลยที่อธิบายเหตุผล ไม่ใช่แค่คำตอบ</p></div>
    </div>
  </section>
  <footer class="border-t border-[var(--line)]"><div class="wrap py-8 text-[13px] text-[var(--muted)] flex flex-wrap gap-x-6 gap-y-2">
    <span>ค่าคงที่อ้างอิง CODATA 2022 (NIST)</span><span>เนื้อหาตรวจทานกับกฎและทฤษฎีฟิสิกส์มาตรฐาน</span><span>ใช้งานได้ดีที่สุดบนคอมพิวเตอร์หรือแท็บเล็ต</span></div></footer>`;
  const btn = $('#heroAtom');
  btn.addEventListener('click', () => Cosmos.primeAudio());   // create the AudioContext inside the click (Safari)
  if (window.THREE) {
    // stop the small atom's render loop before the full-screen journey starts (one WebGL loop at a time)
    try { currentSim = createHeroAtom(btn, () => { stopSim(); Cosmos.open(); }); }
    catch (e) { btn.onclick = () => Cosmos.open(); }
  }
}

/* ════════════════ module page ════════════════ */
function renderModule(m, tab) {
  const tabs = [['learn', 'บทเรียน', m.id], ['sim', 'การจำลอง 3D', m.id + '-sim'], ['quiz', 'แบบฝึกหัด', m.id + '-quiz']];
  view.innerHTML = `
  <div class="modhead"><div class="wrap modhead-in">
    <div class="flex items-center gap-3 min-w-0 mr-auto">
      <span class="hidefocus" style="color:${m.acc}">${ICONS[m.id]}</span>
      <div class="min-w-0"><div class="text-[12px] text-[var(--muted)]"><span class="mono">บทที่ ${m.no}</span> · ${m.en}</div><div class="font-semibold text-[16px] leading-tight truncate">${m.title}</div></div>
    </div>
    <nav class="tabs">${tabs.map(([k, l, h]) => `<a href="#${h}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
  </div></div>
  <div id="tabview"></div>`;
  const tv = $('#tabview');
  if (tab === 'learn') renderLecture(tv, m);
  else if (tab === 'sim') renderSim(tv, m);
  else PracticeUI.render(tv, m);
}

/* ── lecture ── */
let lecObs = null;
function renderLecture(tv, m) {
  const tpl = document.getElementById('lec-' + m.id);
  tv.innerHTML = `<div class="lec-grid"><aside class="toc"><div class="kicker">ในบทนี้</div><div id="tocl"></div></aside>
    <article class="lec" id="lec"><div class="kicker" style="color:${m.acc}">บทที่ ${m.no} · ${m.en}</div><h1>${m.title}</h1></article></div>`;
  const art = $('#lec');
  art.appendChild(tpl.content.cloneNode(true));
  art.insertAdjacentHTML('beforeend', `<div class="nextcards">
     <a href="#${m.id}-sim"><b>ลองในการจำลอง 3D →</b><span>ปรับค่าเองแล้วสังเกตผล</span></a>
     <a href="#${m.id}-quiz"><b>ทำแบบฝึกหัด →</b><span>แบบฝึกหัด ${PRACTICE[m.id].length} ข้อ · ทำถูกแล้ว ${PracticeUI.solved(m.id).done}</span></a></div>`);
  const hs = [...art.querySelectorAll('h2')];
  $('#tocl').innerHTML = hs.map(h => `<a role="button" tabindex="0" data-t="${h.id}">${h.textContent.replace(/^\d+/, '')}</a>`).join('');
  $('#tocl').onclick = e => { const a = e.target.closest('a'); if (a) document.getElementById(a.dataset.t).scrollIntoView({ behavior: 'smooth' }); };
  if (lecObs) lecObs.disconnect();
  lecObs = new IntersectionObserver(es => {
    es.forEach(en => { if (en.isIntersecting) document.querySelectorAll('#tocl a').forEach(a => a.classList.toggle('on', a.dataset.t === en.target.id)); });
  }, { rootMargin: '-20% 0px -70% 0px' });
  hs.forEach(h => lecObs.observe(h));
  if (typeof PracticeUI !== 'undefined') PracticeUI.enhanceWorked(art);
  typeset(art);
}
window.addEventListener('scroll', () => {
  const bar = $('#readbar'); if (!$('#lec')) { bar.style.width = '0'; return; }
  const d = document.documentElement, max = d.scrollHeight - innerHeight;
  bar.style.width = (max > 0 ? Math.min(100, 100 * scrollY / max) : 0) + '%';
}, { passive: true });

/* ── simulation page ── */
const SIMS = {
  mech: () => simProjectile, thermo: () => simGas, waves: () => simRipple,
  particle: () => simParticle, em: () => simEM, atom: () => simAtom, nuclear: () => simNuclear
};
function renderSim(tv, m) {
  tv.innerHTML = `<div class="sim-wrap" id="simwrap">
    <div class="sim-stage" id="stage">
      <div class="sim-tools">
        <button class="tool" id="tPlay"><span id="tPlayI">❚❚</span><span id="tPlayL">หยุด</span></button>
        <button class="tool" id="tReset">↺ มุมมองเริ่มต้น</button>
      </div>
      <div class="zoomtag mono"></div>
      <div class="sim-hint">ลาก: หมุน · ล้อเมาส์ / สองนิ้ว: ซูม · คลิกขวาลาก: เลื่อน</div>
    </div>
    <aside class="sim-panel" id="panel"></aside></div>`;
  const wrap = $('#simwrap'), stage = $('#stage'), panel = $('#panel');
  const fit = () => { if (innerWidth > 900) wrap.style.height = Math.max(540, innerHeight - wrap.getBoundingClientRect().top - scrollY) + 'px'; else wrap.style.height = ''; };
  const showError = msg => stage.insertAdjacentHTML('beforeend', `<div class="nogl">${msg}</div>`);
  fit();
  let host;
  try {
    if (!window.THREE || !THREE.OrbitControls) throw new Error('three');
    host = makeHost(stage);
  } catch (e) {
    showError('เบราว์เซอร์นี้แสดงกราฟิก 3 มิติ (WebGL) ไม่ได้<br>ลองเปิดด้วย Chrome, Edge หรือ Safari รุ่นล่าสุด');
    return;
  }
  window.addEventListener('resize', fit);        // only once the page really owns a 3D view
  currentSim = { dispose() { window.removeEventListener('resize', fit); host.dispose(); } };
  const U = makeUI(panel);
  let sim;
  try { sim = SIMS[m.id]()(host, U); }
  catch (e) {                                    // a broken sim must not leave its render loop running
    console.error(e); stopSim();
    showError('การจำลองนี้โหลดไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง');
    return;
  }
  U.group('มุมมองและขนาด');
  U.slider({ label: 'ขนาดวัตถุ (scale)', min: 0.25, max: 4, step: 0.05, value: 1, fmt: x => '×' + x.toFixed(2) }, x => host.world.scale.setScalar(x));
  U.note('ซูมได้อิสระด้วยล้อเมาส์หรือสองนิ้ว ส่วนแถบ scale ขยายวัตถุทั้งฉากโดยไม่เปลี่ยนมุมกล้อง');
  const setPlayUI = p => { $('#tPlayI').textContent = p ? '❚❚' : '▶'; $('#tPlayL').textContent = p ? 'หยุด' : 'เล่น'; };
  $('#tPlay').onclick = () => setPlayUI(sim.toggle());
  $('#tReset').onclick = () => host.resetView();
  sim.onPlayChange = setPlayUI;
  currentSim = { dispose() { window.removeEventListener('resize', fit); if (sim.dispose) sim.dispose(); host.dispose(); } };
  typeset(panel);
}
