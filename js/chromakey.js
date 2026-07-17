/* ============================================================
 *  chromakey-material : คอมโพเนนต์ A-Frame สำหรับตัดพื้นหลังสีเขียว
 *  (chroma key) ของวิดีโอ ให้เห็นเฉพาะตัวท่าน ผอ.
 *  ใช้งานเมื่อ AR_CONFIG.chromaKey = true
 * ========================================================== */
function hexToRgb01(hex) {
  hex = String(hex || '').trim().replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  var n = parseInt(hex, 16);
  if (isNaN(n) || hex.length !== 6) return [0.149, 0.733, 0.216]; // #26bb37 fallback
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

AFRAME.registerComponent('chromakey-material', {
  schema: {
    src:        { type: 'selector' },
    color:      { type: 'color',  default: '#00d400' },
    similarity: { type: 'number', default: 0.4 },
    smoothness: { type: 'number', default: 0.1 },
    width:      { type: 'number', default: 1 },
    height:     { type: 'number', default: 1 },
  },

  init: function () {
    const video = this.data.src;

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // อ่านสีคีย์เป็นค่า sRGB ดิบ (0–1) ตรง ๆ จาก hex
    // (ไม่ใช้ THREE.Color เพราะ colorManagement จะแปลงเป็น linear ทำให้คีย์เพี้ยน)
    const c = hexToRgb01(this.data.color);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        map:        { value: texture },
        keyColor:   { value: new THREE.Vector3(c[0], c[1], c[2]) },
        similarity: { value: this.data.similarity },
        smoothness: { value: this.data.smoothness },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform vec3 keyColor;
        uniform float similarity;
        uniform float smoothness;
        varying vec2 vUv;

        vec2 RGBtoUV(vec3 rgb) {
          return vec2(
            rgb.r * -0.169 + rgb.g * -0.331 + rgb.b *  0.5   + 0.5,
            rgb.r *  0.5   + rgb.g * -0.419 + rgb.b * -0.081  + 0.5
          );
        }

        void main() {
          vec4 col = texture2D(map, vUv);
          float dist = distance(RGBtoUV(col.rgb), RGBtoUV(keyColor));
          float alpha = smoothstep(similarity, similarity + smoothness, dist);
          gl_FragColor = vec4(col.rgb, col.a * alpha);
        }
      `,
    });

    const geometry = new THREE.PlaneGeometry(this.data.width, this.data.height);
    const mesh = new THREE.Mesh(geometry, material);
    this.el.setObject3D('mesh', mesh);
    this._texture = texture;
  },

  // สำคัญ: ตอน markerless.js เรียก applyPlane() ครั้งแรก วิดีโอยังไม่โหลด metadata
  // (clip.videoWidth = 0) จึง fallback เป็น 9/16 = 0.5625 → ระนาบกว้างเกินจริง
  // พอ metadata มาแล้วเรียก applyPlane() ซ้ำด้วย aspect จริง ถ้าไม่มี update()
  // เรขาคณิตจะค้างที่ค่าแรก ⇒ ท่าน ผอ. ถูกยืดออกข้าง (อ้วน)
  // เช่น หมูม่น 204/534=0.382 → ยืด 0.5625/0.382 = 1.47 เท่า
  update: function (oldData) {
    const mesh = this.el.getObject3D('mesh');
    if (!mesh) return;   // ครั้งแรก init() สร้างให้แล้ว
    if (oldData.width !== this.data.width || oldData.height !== this.data.height) {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(this.data.width, this.data.height);
    }
    const u = mesh.material && mesh.material.uniforms;
    if (u) {
      const c = hexToRgb01(this.data.color);
      u.keyColor.value.set(c[0], c[1], c[2]);
      u.similarity.value = this.data.similarity;
      u.smoothness.value = this.data.smoothness;
    }
  },

  remove: function () {
    this.el.removeObject3D('mesh');
    if (this._texture) this._texture.dispose();
  },
});
