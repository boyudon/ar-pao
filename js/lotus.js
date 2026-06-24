/* ============================================================
 *  ดอกบัวแดง 3D
 *   - lotus-field   : กระจายเป็นทุ่งรอบตัว 360° (ดอกใกล้ใหญ่ ไกลเล็ก)
 *   - lotus-cluster : กระจุกดอกใหญ่ (ใช้วางตรงเท้าท่าน ผอ.)
 *  หลากสี (แดง/ชมพู/บานเย็น/ขาว) + โยกขึ้นลงเบา ๆ
 *  โมเดล: "Lotus Flower" by Sean Tarrant (CC-BY) · poly.pizza
 * ========================================================== */
(function () {
  const PALETTE = [
    '#c01a3a', '#d61f3d', '#e0243f', '#ff3d6a', '#ff3d6a',
    '#ff5e86', '#ff6f99', '#ffa6c4', '#c84fb0', '#a8123f', '#ffd0e0',
  ];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function buildLotus(src, x, y, z, s) {
    const color = pick(PALETTE);
    const el = document.createElement('a-entity');
    el.setAttribute('gltf-model', src);
    el.setAttribute('position', x.toFixed(2) + ' ' + y + ' ' + z.toFixed(2));
    el.setAttribute('rotation',
      rnd(-4, 4).toFixed(1) + ' ' + ((Math.random() * 360) | 0) + ' ' + rnd(-4, 4).toFixed(1));
    el.setAttribute('scale', s.toFixed(2) + ' ' + s.toFixed(2) + ' ' + s.toFixed(2));

    const amp = rnd(0.03, 0.09), dur = 2000 + ((Math.random() * 2200) | 0);
    el.setAttribute('animation__bob',
      'property: object3D.position.y; from: ' + y + '; to: ' + (y + amp).toFixed(3) +
      '; dir: alternate; loop: true; dur: ' + dur + '; easing: easeInOutSine');

    el.addEventListener('model-loaded', function (ev) {
      const root = ev.detail && ev.detail.model;
      if (!root) return;
      root.traverse(function (n) {
        if (n.isMesh && n.material) {
          n.material = n.material.clone();
          if (n.material.color) n.material.color.set(color);
        }
      });
    });
    return el;
  }

  if (typeof AFRAME === 'undefined') return;

  // ทุ่งดอกบัวรอบตัว 360°
  AFRAME.registerComponent('lotus-field', {
    schema: {
      src:   { type: 'string', default: '#lotusModel' },
      count: { type: 'int',    default: 70 },
      near:  { type: 'number', default: 0.8 },
      far:   { type: 'number', default: 9 },
      scale: { type: 'number', default: 1.0 },
    },
    init: function () {
      const d = this.data;
      for (let i = 0; i < d.count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = d.near + (d.far - d.near) * Math.sqrt(Math.random());
        const x = Math.cos(ang) * rad;
        const z = Math.sin(ang) * rad;
        const sizeF = 1.2 - 0.7 * ((rad - d.near) / (d.far - d.near));
        const s = d.scale * sizeF * rnd(0.8, 1.2);
        this.el.appendChild(buildLotus(d.src, x, 0, z, s));
      }
    },
  });

  // กระจุกดอกใหญ่ (วางตรงเท้าท่าน ผอ.)
  AFRAME.registerComponent('lotus-cluster', {
    schema: {
      src:    { type: 'string', default: '#lotusModel' },
      count:  { type: 'int',    default: 8 },
      radius: { type: 'number', default: 0.8 },
      scale:  { type: 'number', default: 2.0 },
      y:      { type: 'number', default: 0 },
    },
    init: function () {
      const d = this.data;
      for (let i = 0; i < d.count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * d.radius;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        const s = d.scale * rnd(0.8, 1.3);
        this.el.appendChild(buildLotus(d.src, x, d.y, z, s));
      }
    },
  });
})();
