/* ============================================================
 *  lotus-field — กระจายโมเดลดอกบัว 3D หลายดอกรอบ ๆ ผู้ชม
 *  วางบนผืนน้ำ (y≈0) สุ่มตำแหน่ง/หมุน/ขนาด + โยกขึ้นลงเบา ๆ
 *  โมเดล: "Lotus Flower" by Sean Tarrant (CC-BY) · poly.pizza
 * ========================================================== */
AFRAME.registerComponent('lotus-field', {
  schema: {
    src:   { type: 'string', default: '#lotusModel' },
    count: { type: 'int',    default: 16 },
    inner: { type: 'number', default: 1.4 },  // ไม่วางใกล้ผู้ชมเกินไป
    outer: { type: 'number', default: 7 },
    scale: { type: 'number', default: 1.0 },
    y:     { type: 'number', default: 0 },
  },
  init: function () {
    const d = this.data;
    for (let i = 0; i < d.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = d.inner + Math.random() * (d.outer - d.inner);
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const s = d.scale * (0.7 + Math.random() * 0.6);

      const el = document.createElement('a-entity');
      el.setAttribute('gltf-model', d.src);
      el.setAttribute('position', x.toFixed(2) + ' ' + d.y + ' ' + z.toFixed(2));
      el.setAttribute('rotation', '0 ' + Math.floor(Math.random() * 360) + ' 0');
      el.setAttribute('scale', s.toFixed(2) + ' ' + s.toFixed(2) + ' ' + s.toFixed(2));

      // โยกขึ้น-ลงเบา ๆ ให้เหมือนลอยน้ำ
      const dur = 2200 + Math.floor(Math.random() * 1800);
      el.setAttribute('animation__bob',
        'property: object3D.position.y; from: ' + d.y + '; to: ' + (d.y + 0.06).toFixed(3) +
        '; dir: alternate; loop: true; dur: ' + dur + '; easing: easeInOutSine');

      this.el.appendChild(el);
    }
  },
});
