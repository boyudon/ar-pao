/* ============================================================
 *  chromakey-material : คอมโพเนนต์ A-Frame สำหรับตัดพื้นหลังสีเขียว
 *  (chroma key) ของวิดีโอ ให้เห็นเฉพาะตัวท่าน ผอ.
 *  ใช้งานเมื่อ AR_CONFIG.chromaKey = true
 * ========================================================== */
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

    const c = new THREE.Color(this.data.color);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        map:        { value: texture },
        keyColor:   { value: new THREE.Vector3(c.r, c.g, c.b) },
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

  remove: function () {
    this.el.removeObject3D('mesh');
    if (this._texture) this._texture.dispose();
  },
});
