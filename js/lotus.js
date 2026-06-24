/* ============================================================
 *  lotus-field — กระจายโมเดลดอกบัว 3D เป็น "ทุ่ง" ด้านหน้าผู้ชม
 *  ดอกอยู่ทั้งหน้าและหลังท่าน ผอ. (ตามระยะลึก), ดอกใกล้ใหญ่ ไกลเล็ก
 *  หลากสี (แดง/ชมพู/บานเย็น/ขาว) + โยกขึ้นลงเบา ๆ
 *  โมเดล: "Lotus Flower" by Sean Tarrant (CC-BY) · poly.pizza
 * ========================================================== */
AFRAME.registerComponent('lotus-field', {
  schema: {
    src:   { type: 'string', default: '#lotusModel' },
    count: { type: 'int',    default: 70 },
    near:  { type: 'number', default: 0.8 },   // ดอกใกล้สุด (หน้า ผอ.)
    far:   { type: 'number', default: 9 },     // ดอกไกลสุด (หลัง ผอ.)
    scale: { type: 'number', default: 1.0 },
    y:     { type: 'number', default: 0 },
  },

  // จานสีดอกบัว (เน้นแดง/ชมพู มีบานเย็นและขาวแซม)
  palette: [
    '#c01a3a', '#d61f3d', '#e0243f', '#ff3d6a', '#ff3d6a',
    '#ff5e86', '#ff6f99', '#ffa6c4', '#c84fb0', '#a8123f', '#ffd0e0',
  ],

  init: function () {
    const d = this.data;
    const pal = this.palette;

    for (let i = 0; i < d.count; i++) {
      const t = Math.random();                       // 0 = ใกล้, 1 = ไกล
      const depth = d.near + (d.far - d.near) * t;
      const z = -depth;
      // กว้างขึ้นเมื่อไกล (เป็นทุ่งบานออก)
      const spread = 1.3 + depth * 0.95;
      const x = (Math.random() * 2 - 1) * spread;
      // ดอกใกล้ใหญ่ ดอกไกลเล็ก
      const sizeF = 1.15 - 0.72 * t;
      const s = d.scale * sizeF * (0.8 + Math.random() * 0.4);
      const color = pal[(Math.random() * pal.length) | 0];

      const el = document.createElement('a-entity');
      el.setAttribute('gltf-model', d.src);
      el.setAttribute('position', x.toFixed(2) + ' ' + d.y + ' ' + z.toFixed(2));
      el.setAttribute('rotation',
        (Math.random() * 8 - 4).toFixed(1) + ' ' +
        ((Math.random() * 360) | 0) + ' ' +
        (Math.random() * 8 - 4).toFixed(1));
      el.setAttribute('scale', s.toFixed(2) + ' ' + s.toFixed(2) + ' ' + s.toFixed(2));

      const amp = (0.03 + Math.random() * 0.06);
      const dur = 2000 + ((Math.random() * 2200) | 0);
      el.setAttribute('animation__bob',
        'property: object3D.position.y; from: ' + d.y +
        '; to: ' + (d.y + amp).toFixed(3) +
        '; dir: alternate; loop: true; dur: ' + dur + '; easing: easeInOutSine');

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
