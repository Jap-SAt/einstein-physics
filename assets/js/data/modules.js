/* ════════════════ modules ════════════════
   group: 'classic' = ฟิสิกส์คลาสสิก, 'modern' = ฟิสิกส์ยุคใหม่
   acc / soft: CSS variables for the chapter accent colour (light + dark themes in style.css) */
const ICONS = {
  mech: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 20c2.5-11 8-15 13-9.5 1.6 1.8 3 4.7 5 9.5" stroke-dasharray="2.2 2.4"/><circle cx="9.6" cy="8.4" r="1.9" fill="currentColor" stroke="none"/><path d="M2 20.5h20" stroke-opacity=".35"/></svg>',
  thermo: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 4.2a2 2 0 0 1 4 0v9.3a4.2 4.2 0 1 1-4 0z"/><path d="M12 10v6.4"/><circle cx="12" cy="17" r="1.6" fill="currentColor" stroke="none"/><path d="M17 6h3M17 9.5h2" stroke-opacity=".5"/></svg>',
  waves: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1.4" fill="currentColor" stroke="none"/><path d="M8 7.5a4.5 4.5 0 0 1 0 9M16 7.5a4.5 4.5 0 0 0 0 9" stroke-opacity=".8"/><path d="M8 4a8 8 0 0 1 0 16M16 4a8 8 0 0 0 0 16" stroke-opacity=".4"/></svg>',
  estat: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="12" r="3" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4" stroke-opacity=".5" stroke-dasharray="1.8 1.8"/><path d="M9 7c2-2 4-2 6 0M9 17c2 2 4 2 6 0" stroke-opacity=".4"/><path d="M15.6 12h2.8" stroke-width="1.4"/></svg>',
  particle: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20c0-4 2-6 4-6s4 2 4 0-2-4 0-6 4-2 4 0-2 4 0 4 4-2 4-6"/><circle cx="20" cy="6" r="1.6" fill="currentColor"/></svg>',
  em: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-3"/><path d="M2 12h20" stroke-opacity=".35"/></svg>',
  atom: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9.5"/><circle cx="17" cy="12" r="1.3" fill="currentColor"/></svg>',
  nuclear: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="10" cy="10" r="3"/><circle cx="14.5" cy="10.5" r="3" fill-opacity=".45"/><circle cx="12" cy="14.5" r="3" fill-opacity=".7"/><circle cx="9" cy="14" r="3" fill-opacity=".35"/></svg>'
};
const MODS = [
  { id: 'mech', no: '01', group: 'classic', short: 'กลศาสตร์', en: 'The Foundation & Mechanics', title: 'รากฐานและกลศาสตร์', sub: 'หน่วยและเวกเตอร์ · โพรเจกไทล์ · กฎของนิวตัน · พลังงาน · วงโคจร', acc: 'var(--a5)', soft: 'var(--a5s)' },
  { id: 'thermo', no: '02', group: 'classic', short: 'อุณหพลศาสตร์', en: 'Matter & Thermodynamics', title: 'สสารและอุณหพลศาสตร์', sub: 'แบบจำลองอนุภาค · ความร้อน · ทฤษฎีจลน์ของแก๊ส · กฎอุณหพลศาสตร์', acc: 'var(--a6)', soft: 'var(--a6s)' },
  { id: 'waves', no: '03', group: 'classic', short: 'คลื่นและแสง', en: 'Waves & Optics', title: 'คลื่นและทัศนศาสตร์', sub: 'สมบัติคลื่น · การแทรกสอด · การหักเห · สลิตคู่ · เลนส์', acc: 'var(--a7)', soft: 'var(--a7s)' },
  { id: 'estat', no: '04', group: 'classic', short: 'ไฟฟ้าสถิต', en: 'Electrostatics', title: 'ไฟฟ้าสถิต', sub: 'ประจุ · กฎของคูลอมบ์ · สนามและศักย์ · ตัวเก็บประจุ', acc: 'var(--a8)', soft: 'var(--a8s)' },
  { id: 'particle', no: '05', group: 'modern', short: 'อนุภาค', en: 'Charged Particles', title: 'อนุภาคในสนามแม่เหล็ก', sub: 'แรงลอเรนซ์ · วงกลม · เกลียว · ตัวเลือกความเร็ว', acc: 'var(--a1)', soft: 'var(--a1s)' },
  { id: 'em', no: '06', group: 'modern', short: 'คลื่น EM', en: 'Electromagnetic Waves', title: 'คลื่นแม่เหล็กไฟฟ้า', sub: 'การเกิดคลื่น · สเปกตรัม · โพลาไรเซชัน', acc: 'var(--a2)', soft: 'var(--a2s)' },
  { id: 'atom', no: '07', group: 'modern', short: 'อะตอม', en: 'Atomic Physics', title: 'ฟิสิกส์อะตอม', sub: 'แบบจำลองโบร์ · สเปกตรัมไฮโดรเจน · โฟโตอิเล็กทริก', acc: 'var(--a3)', soft: 'var(--a3s)' },
  { id: 'nuclear', no: '08', group: 'modern', short: 'นิวเคลียร์', en: 'Nuclear Physics', title: 'ฟิสิกส์นิวเคลียร์', sub: 'กัมมันตภาพรังสี · ครึ่งชีวิต · พลังงานยึดเหนี่ยว', acc: 'var(--a4)', soft: 'var(--a4s)' }
];
const GROUPS = [
  { id: 'classic', title: 'ฟิสิกส์คลาสสิก', en: 'Classical Physics' },
  { id: 'modern', title: 'ฟิสิกส์ยุคใหม่', en: 'Modern Physics' }
];
