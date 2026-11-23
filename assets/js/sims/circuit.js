/* ─────────── Sim : circuit lab (stub — filled in by a later task) ─────────── */
function simCircuit(host, U) {
  host.setHome(new THREE.Vector3(10, 8, 12), new THREE.Vector3(0, 0, 0));
  let play = true;
  U.head('ห้องทดลองวงจรไฟฟ้า', 'กำลังจัดทำ');
  U.note('ห้องทดลองนี้กำลังถูกสร้าง จะเปิดใช้งานได้เร็ว ๆ นี้');
  return {
    toggle() { play = !play; return play; },
    dispose() {}
  };
}
