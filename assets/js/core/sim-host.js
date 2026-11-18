/* ════════════════ simulation host ════════════════ */
function makeLabel(text, color = '#17191e', size = 1) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d'), fs = 64;
  const font = `600 ${fs}px Inter, "IBM Plex Sans Thai", sans-serif`;
  ctx.font = font; const w = Math.ceil(ctx.measureText(text).width) + 20;
  c.width = w; c.height = fs + 24; ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 10, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size * w / c.height, size, 1); return s;
}

function makeHost(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(isDark() ? 0x0f1013 : 0xfbfaf7, 1);
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 4000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 1.5; controls.maxDistance = 600; controls.zoomSpeed = 0.9;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd2ccbf, 0.9));
  const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(6, 12, 8); scene.add(dl);
  const world = new THREE.Group(); scene.add(world);
  const home = { p: new THREE.Vector3(10, 10, 10), t: new THREE.Vector3() };
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();
  let raf = 0, last = performance.now(), fn = () => {};
  const zt = stage.querySelector('.zoomtag');
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    fn(dt); controls.update(); renderer.render(scene, camera);
    if (zt) { const z = home.p.distanceTo(home.t) / camera.position.distanceTo(controls.target); zt.textContent = 'ซูม ×' + z.toFixed(2) + ' · scale ×' + world.scale.x.toFixed(2); }
  }
  raf = requestAnimationFrame(loop);
  return {
    scene, camera, controls, world, renderer,
    setHome(p, t) { home.p.copy(p); home.t.copy(t); camera.position.copy(p); controls.target.copy(t); controls.update(); },
    resetView() { camera.position.copy(home.p); controls.target.copy(home.t); controls.update(); },
    onUpdate(f) { fn = f; },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mm => { if (mm.map) mm.map.dispose(); mm.dispose(); }); });
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}

function makeUI(panel) {
  let uid = 0; const nid = () => 'u' + (++uid) + Math.random().toString(36).slice(2, 6);
  return {
    head(t, s) { panel.insertAdjacentHTML('beforeend', `<div class="p-title">${t}</div>${s ? `<div class="p-sub">${s}</div>` : ''}`); },
    group(t) { panel.insertAdjacentHTML('beforeend', `<div class="p-group">${t}</div>`); },
    html(h) { panel.insertAdjacentHTML('beforeend', h); return panel.lastElementChild; },
    note(h) { panel.insertAdjacentHTML('beforeend', `<div class="note">${h}</div>`); return panel.lastElementChild; },
    slider(o, cb) {
      const id = nid();
      panel.insertAdjacentHTML('beforeend', `<div class="ctl"><div class="ctl-row"><label for="${id}">${o.label}</label><span class="mono ctl-val" id="${id}v"></span></div><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.value}"></div>`);
      const el = document.getElementById(id), v = document.getElementById(id + 'v');
      const upd = () => { const x = parseFloat(el.value); v.textContent = o.fmt ? o.fmt(x) : x; cb(x); };
      el.addEventListener('input', upd); upd();
      el.setValue = x => { el.value = x; upd(); };
      return el;
    },
    seg(o, cb) {
      const id = nid();
      panel.insertAdjacentHTML('beforeend', `<div class="ctl">${o.label ? `<div class="ctl-row"><label>${o.label}</label></div>` : ''}<div class="seg" id="${id}">${o.options.map(([v, t]) => `<button data-v="${v}" class="${v === o.value ? 'on' : ''}">${t}</button>`).join('')}</div></div>`);
      const box = document.getElementById(id);
      box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); });
      cb(o.value); return box;
    },
    check(label, val, cb) {
      const id = nid();
      panel.insertAdjacentHTML('beforeend', `<label class="chk"><input type="checkbox" id="${id}" ${val ? 'checked' : ''}><span>${label}</span></label>`);
      const el = document.getElementById(id); el.addEventListener('change', () => cb(el.checked)); cb(val); return el;
    },
    readouts(title, items) {
      panel.insertAdjacentHTML('beforeend', `<div class="ro-box"><div class="ro-title">${title}</div>${items.map(([k, l]) => `<div class="ro"><span>${l}</span><span class="mono" data-k="${k}">—</span></div>`).join('')}</div>`);
      const box = panel.lastElementChild, map = {};
      items.forEach(([k]) => map[k] = box.querySelector(`[data-k="${k}"]`)); return map;
    }
  };
}

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
  fit(); window.addEventListener('resize', fit);
  let host;
  try {
    if (!window.THREE || !THREE.OrbitControls) throw new Error('three');
    host = makeHost(stage);
  } catch (e) {
    stage.insertAdjacentHTML('beforeend', '<div class="nogl">เบราว์เซอร์นี้แสดงกราฟิก 3 มิติ (WebGL) ไม่ได้<br>ลองเปิดด้วย Chrome, Edge หรือ Safari รุ่นล่าสุด</div>');
    return;
  }
  const U = makeUI(panel);
  const SIMS = { particle: simParticle, em: simEM, atom: simAtom, nuclear: simNuclear };
  const sim = SIMS[m.id](host, U);
  U.group('มุมมองและขนาด');
  U.slider({ label: 'ขนาดวัตถุ (scale)', min: 0.25, max: 4, step: 0.05, value: 1, fmt: x => '×' + x.toFixed(2) }, x => host.world.scale.setScalar(x));
  U.note('ซูมได้อิสระด้วยล้อเมาส์หรือสองนิ้ว ส่วนแถบ scale ขยายวัตถุทั้งฉากโดยไม่เปลี่ยนมุมกล้อง');
  const setPlayUI = p => { $('#tPlayI').textContent = p ? '❚❚' : '▶'; $('#tPlayL').textContent = p ? 'หยุด' : 'เล่น'; };
  $('#tPlay').onclick = () => setPlayUI(sim.toggle());
  $('#tReset').onclick = () => host.resetView();
  sim.onPlayChange = setPlayUI;
  currentSim = { dispose() { window.removeEventListener('resize', fit); host.dispose(); } };
  typeset(panel);
}
