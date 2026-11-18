/* ════════════════ helpers ════════════════ */
const $ = (s, el = document) => el.querySelector(s);
const isDark = () => document.documentElement.classList.contains('dark');
const inkHex = () => (isDark() ? 0xe9e6df : 0x17191e);
const gridHex = () => (isDark() ? [0x33353b, 0x23252a] : [0xdcd8cf, 0xebe8e1]);
const store = {
  get(k, d) { try { const v = localStorage.getItem('einstein_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('einstein_' + k, JSON.stringify(v)); } catch (e) {} }
};
function typeset(el) {
  if (window.MathJax && MathJax.typesetPromise) { MathJax.typesetPromise([el]).catch(() => {}); }
  else setTimeout(() => typeset(el), 150);
}
const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
function sci(x, d = 2) {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e < 4) return x.toFixed(Math.max(0, d - e));
  const m = x / Math.pow(10, e);
  return m.toFixed(d) + ' × 10' + String(e).split('').map(c => SUP[c]).join('');
}
function si(x, unit, d = 3) {
  const P = [[1e24,'Y'],[1e21,'Z'],[1e18,'E'],[1e15,'P'],[1e12,'T'],[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p'],[1e-15,'f']];
  for (const [v, p] of P) if (Math.abs(x) >= v * 0.9995) return (x / v).toPrecision(d) + ' ' + p + unit;
  return sci(x) + ' ' + unit;
}
const sgn = x => (x >= 0 ? '+' : '−') + Math.abs(x);
function fx(x, d) { const s = x.toFixed(d); return (x < 0 ? '−' + s.slice(1) : ' ' + s); }
function wl2rgb(nm) {
  if (nm < 380 || nm > 750) return null;
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else { r = 1; }
  let f = 1;
  if (nm < 420) f = 0.35 + 0.65 * (nm - 380) / 40; else if (nm > 700) f = 0.35 + 0.65 * (750 - nm) / 50;
  return [r * f, g * f, b * f];
}
const rgbCss = a => `rgb(${Math.round(a[0]*255)},${Math.round(a[1]*255)},${Math.round(a[2]*255)})`;

/* theme: 'light' | 'dark' — stored per browser, applied on <html> */
const Theme = {
  get() { return isDark() ? 'dark' : 'light'; },
  set(t) {
    document.documentElement.classList.toggle('dark', t === 'dark');
    store.set('theme', t);
    window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  },
  toggle() { this.set(isDark() ? 'light' : 'dark'); }
};
