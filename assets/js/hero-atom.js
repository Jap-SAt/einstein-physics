/* ════════════════ hero atom ════════════════
   Small 3D carbon-12 atom beside the home headline.
   Hover: electrons speed up. Click: electrons fall inward, nucleus flares, then onActivate() (→ Cosmos.open). */
function createHeroAtom(btn, onActivate) {
  const dark = isDark();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  btn.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100); cam.position.set(0, 0, 10);
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x3a3630 : 0x9a9182, dark ? 0.75 : 1.0));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(3, 4, 6); scene.add(dl);

  const atom = new THREE.Group(); scene.add(atom);
  // nucleus: 6 protons + 6 neutrons packed on a small sphere
  const nucleus = new THREE.Group(); atom.add(nucleus);
  const pMat = new THREE.MeshStandardMaterial({ color: 0xe0533f, roughness: 0.35, emissive: 0xff7a3d, emissiveIntensity: 0 });
  const nMat = new THREE.MeshStandardMaterial({ color: dark ? 0xd8d2c6 : 0xa19c93, roughness: 0.4, emissive: 0xffc27a, emissiveIntensity: 0 });
  const nGeo = new THREE.SphereGeometry(0.3, 22, 16);
  for (let i = 0; i < 12; i++) {
    const y = 1 - (i / 11) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    const s = new THREE.Mesh(nGeo, i % 2 ? pMat : nMat);
    s.position.set(Math.cos(th) * r * 0.44, y * 0.44, Math.sin(th) * r * 0.44);
    nucleus.add(s);
  }
  // three elliptical orbits (classic atom symbol) with one electron each
  const ringMat = new THREE.MeshBasicMaterial({ color: dark ? 0x8d887d : 0x8f8a80, transparent: true, opacity: dark ? 0.6 : 0.5 });
  const eMat = new THREE.MeshStandardMaterial({ color: 0x3a5bd9, emissive: 0x4f6dff, emissiveIntensity: dark ? 0.9 : 0.45, roughness: 0.3 });
  const eGeo = new THREE.SphereGeometry(0.17, 18, 12);
  const RX = 2.75, RY = 0.98, orbits = [];
  [0, 60, 120].forEach((deg, k) => {
    const g = new THREE.Group(); g.rotation.z = deg * Math.PI / 180; atom.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RX, 0.024, 8, 160), ringMat); ring.scale.set(1, RY / RX, 1); g.add(ring);
    const e = new THREE.Mesh(eGeo, eMat); g.add(e);
    orbits.push({ g, e, phase: k * 2.1, speed: 1.6 + k * 0.25 });
  });

  let hover = false, spin = 1, scale = 1, collapse = -1, raf = 0, last = performance.now();
  const onEnter = () => hover = true, onLeave = () => hover = false;
  const onClick = () => { if (collapse < 0) collapse = 0; };
  btn.addEventListener('mouseenter', onEnter); btn.addEventListener('mouseleave', onLeave);
  btn.addEventListener('focus', onEnter); btn.addEventListener('blur', onLeave);
  btn.addEventListener('click', onClick);

  function resize() { const w = btn.clientWidth || 160; renderer.setSize(w, w, false); }
  const ro = new ResizeObserver(resize); ro.observe(btn); resize();

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    spin += ((hover ? 3 : 1) - spin) * Math.min(1, dt * 4);
    scale += ((hover ? 1.08 : 1) - scale) * Math.min(1, dt * 6);
    let shrink = 1;
    if (collapse >= 0) {
      collapse += dt;
      const u = Math.min(1, collapse / 0.9);
      shrink = 1 - u * u;                       // electrons spiral into the nucleus
      spin = 3 + 14 * u;
      pMat.emissiveIntensity = nMat.emissiveIntensity = 2.2 * u;
      nucleus.scale.setScalar(1 + 0.9 * u);
      if (u >= 1 && collapse < 10) { collapse = 10; onActivate && onActivate(); setTimeout(reset, 900); }
    }
    orbits.forEach(o => {
      o.phase += dt * o.speed * spin;
      o.e.position.set(RX * shrink * Math.cos(o.phase), RY * shrink * Math.sin(o.phase), 0);
    });
    atom.rotation.y = Math.sin(now / 4000) * 0.45;
    atom.rotation.x = Math.cos(now / 5200) * 0.25;
    if (collapse < 0) nucleus.scale.setScalar(1 + 0.03 * Math.sin(now / 400));
    atom.scale.setScalar(scale);
    renderer.render(scene, cam);
  }
  function reset() { collapse = -1; spin = 1; pMat.emissiveIntensity = nMat.emissiveIntensity = 0; nucleus.scale.setScalar(1); }
  raf = requestAnimationFrame(loop);

  return {
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      btn.removeEventListener('mouseenter', onEnter); btn.removeEventListener('mouseleave', onLeave);
      btn.removeEventListener('focus', onEnter); btn.removeEventListener('blur', onLeave);
      btn.removeEventListener('click', onClick);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}
