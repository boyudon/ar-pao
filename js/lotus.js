/* ============================================================
 *  lotus-field — กระจายโมเดลดอกบัว 3D หลายดอกรอบ ๆ ผู้ชม
 *  หลากสี (แดงเข้ม/แดง/ชมพู/บานเย็น/ขาว) สุ่มขนาด/หมุน/เอียง + โยกขึ้นลง
 *  โมเดล: "Lotus Flower" by Sean Tarrant (CC-BY) · poly.pizza
 * ========================================================== */
AFRAME.registerComponent('lotus-field', {
  schema: {
    src:   { type: 'string', default: '#lotusModel' },
    count: { type: 'int',    default: 60 },
    inner: { type: 'number', default: 1.2 },  // ไม่วางใกล้ผู้ชมเกินไป
    outer: { type: 'number', default: 10 },
    scale: { type: 'number', default: 1.0 },
    y:     { type: 'number', default: 0 },
  },

  // จานสีดอกบัว (เน้นแดง/ชมพู มีบานเย็นและขาวแซม)
  palette: [
    '#b3122e', '#d61f3d', '#e0243f', '#ff3d6a', '#ff3d6a',
    '#ff6f99', '#ff6f99', '#ffa6c4', '#c84fb0', '#9e0f3a', '#ffd9e6',
  ],

  init: function () {
    const d = this.data;
    const pal = this.palette;

    for (let i = 0; i < d.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      // กระจายแบบ sqrt ให้หนาแน่นใกล้ ๆ และบางลงไกล ๆ (ดูเป็นทะเลบัว)
      const rad = d.inner + (d.outer - d.inner) * Math.sqrt(Math.random());
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const s = d.scale * (0.5 + Math.random() * 0.95);
      const color = pal[(Math.random() * pal.length) | 0];

      const el = document.createElement('a-entity');
      el.setAttribute('gltf-model', d.src);
      el.setAttribute('position', x.toFixed(2) + ' ' + d.y + ' ' + z.toFixed(2));
      // หมุนรอบแกนตั้ง + เอียงเล็กน้อยให้เป็นธรรมชาติ
      el.setAttribute('rotation',
        (Math.random() * 8 - 4).toFixed(1) + ' ' +
        ((Math.random() * 360) | 0) + ' ' +
        (Math.random() * 8 - 4).toFixed(1));
      el.setAttribute('scale', s.toFixed(2) + ' ' + s.toFixed(2) + ' ' + s.toFixed(2));

      // โยกขึ้น-ลงเบา ๆ (สุ่มจังหวะ/ระยะ) ให้เหมือนลอยน้ำ
      const amp = (0.03 + Math.random() * 0.06);
      const dur = 2000 + ((Math.random() * 2200) | 0);
      el.setAttribute('animation__bob',
        'property: object3D.position.y; from: ' + d.y +
        '; to: ' + (d.y + amp).toFixed(3) +
        '; dir: alternate; loop: true; dur: ' + dur + '; easing: easeInOutSine');

      // ย้อมสีต่อดอกเมื่อโมเดลโหลดเสร็จ
      (function (col) {
        el.addEventListener('model-loaded', function (ev) {
          const root = ev.detail && ev.detail.model;
          if (!root) return;
          root.traverse(function (n) {
            if (n.isMesh && n.material) {
              n.material = n.material.clone();
              if (n.material.color) n.material.color.set(col);
            }
          });
        });
      })(color);

      this.el.appendChild(el);
    }
  },
});
