/* ============================================================
 *  markerless.js — ผอ. ยืนกลางทะเลบัวแดง (ฉากหลัง 360° หมุนได้)
 *  แตะเริ่ม → เล่นคลิป ผอ. (ตัดฉากเขียว) + ดอกบัว 3D รอบตัว
 *  หมุน/ส่ายมือถือ → มองรอบฉากทะเลบัวแดงได้ (ไจโร 3DOF)
 * ========================================================== */
(function () {
  // คอมโพเนนต์: ให้ระนาบ ผอ. หันเข้าหากล้องเสมอ (แกนตั้ง)
  if (typeof AFRAME !== 'undefined' && !AFRAME.components['billboard-yaw']) {
    AFRAME.registerComponent('billboard-yaw', {
      tick: function () {
        var cam = this.el.sceneEl && this.el.sceneEl.camera;
        if (!cam) return;
        var obj = this.el.object3D;
        var cw = new THREE.Vector3(), ow = new THREE.Vector3();
        cam.getWorldPosition(cw);
        obj.getWorldPosition(ow);
        obj.rotation.set(0, Math.atan2(cw.x - ow.x, cw.z - ow.z), 0);
      },
    });
  }

  const cfg = window.AR_CONFIG || {};
  function log(m) { if (window.__arlog) window.__arlog(m); }

  document.addEventListener('DOMContentLoaded', function () {
    const clip     = document.getElementById('clip');
    const director = document.getElementById('director');
    const plane    = document.getElementById('director-plane');
    const boat     = document.getElementById('boat');
    const boatLotus = document.getElementById('boat-lotus');
    const camEl    = document.getElementById('cam');
    const intro    = document.getElementById('intro');
    const loading  = document.getElementById('loading');
    const hint     = document.getElementById('hint');
    const startBtn = document.getElementById('start-btn');

    // ---- ข้อความ ----
    const ui = cfg.ui || {};
    setText('org-name', ui.orgName);
    setText('app-title', ui.title);
    setText('intro-text', ui.introMarkerless || ui.intro);
    setText('start-btn', ui.startButton);
    setText('loading-text', ui.loadingText);
    setText('hint-text', ui.hintText);

    if (cfg.videoSrc) clip.setAttribute('src', cfg.videoSrc);

    // ---- ตำแหน่ง/ขนาด ผอ. ----
    const w = cfg.world || {};
    const dist = w.distanceMeters != null ? w.distanceMeters : 1.8;
    const H    = w.heightMeters   != null ? w.heightMeters   : 2.4;
    const yOff = w.yOffset        != null ? w.yOffset         : 0;
    const centerY = yOff + H / 2;
    director.setAttribute('position', '0 ' + centerY + ' ' + (-dist));
    // billboard เฉพาะระนาบ ผอ. (เรือ/ดอกบัวจะได้ไม่หมุนตาม)
    if (w.faceUser !== false) plane.setAttribute('billboard-yaw', '');
    // เรือ + วงดอกบัวล้อมรอบ: ลงไปอยู่ระดับพื้น (y=0 ของโลก)
    const boatCfg = cfg.boat || {};
    if (boat) {
      boat.setAttribute('position', '0 ' + (-centerY) + ' 0');
      const bs = boatCfg.scale != null ? boatCfg.scale : 0.05;
      boat.setAttribute('scale', bs + ' ' + bs + ' ' + bs);
      boat.setAttribute('rotation', '0 ' + (boatCfg.rotationY != null ? boatCfg.rotationY : 0) + ' 0');
    }
    if (boatLotus) boatLotus.setAttribute('position', '0 ' + (-centerY) + ' 0');
    // แท่นยืนใต้เท้า ผอ. (เฉพาะหน้าที่มี #pedestal): ฐานแท่นอยู่ระดับพื้นโลก
    // ใช้คู่กับ world.yOffset ให้เท้า (จุดล่างสุดของตัวในคลิป) แตะผิวแท่นพอดี
    // cfg.pedestal.offsetX = เลื่อนแท่นซ้าย/ขวา (เมตร) ให้กึ่งกลางแท่นตรงเท้า
    // (#pedestal ต้องเป็น child ของ #director-plane เพื่อให้ offset หมุนตาม billboard)
    const pedestal = document.getElementById('pedestal');
    if (pedestal) {
      const pedX = (cfg.pedestal && cfg.pedestal.offsetX != null) ? cfg.pedestal.offsetX : 0;
      pedestal.setAttribute('position', pedX + ' ' + (-centerY) + ' 0');
    }
    // เงานุ่มใต้เท้า (เฉพาะหน้าที่มี #feet-shadow): วางที่ "ระดับเท้า" ในเฟรมวิดีโอ
    // (แทนแท่นยืน) — feetFrac = สัดส่วนช่องว่างใต้เท้าจากขอบล่างเฟรม, offsetX = กึ่งกลางสองเท้า
    // เป็น child ของ #director-plane → เงาเลื่อน/หมุนตาม billboard อยู่ใต้เท้าเสมอ
    const feetShadow = document.getElementById('feet-shadow');
    if (feetShadow) {
      const fsX = (cfg.pedestal && cfg.pedestal.offsetX != null) ? cfg.pedestal.offsetX : 0;
      const feetFrac = (w.feetFrac != null) ? w.feetFrac : 0.035;
      const feetLocalY = -H / 2 + feetFrac * H;   // ตำแหน่งเท้าเทียบจุดกลางระนาบ
      feetShadow.setAttribute('position', fsX + ' ' + feetLocalY.toFixed(3) + ' 0.02');
    }

    function applyPlane() {
      const aspect = (clip.videoWidth && clip.videoHeight)
        ? (clip.videoWidth / clip.videoHeight) : (9 / 16);
      const width = H * aspect;
      if (cfg.chromaKey) {
        plane.removeAttribute('material');
        plane.removeAttribute('geometry');
        plane.setAttribute('chromakey-material',
          'src: #clip;' +
          ' color: ' + (cfg.chromaColor || '#26bb37') + ';' +
          ' similarity: ' + (cfg.chromaSimilarity != null ? cfg.chromaSimilarity : 0.2) + ';' +
          ' smoothness: ' + (cfg.chromaSmoothness != null ? cfg.chromaSmoothness : 0.1) + ';' +
          ' width: ' + width + '; height: ' + H);
      } else {
        plane.setAttribute('geometry', 'primitive: plane; width: ' + width + '; height: ' + H);
        plane.setAttribute('material', 'shader: flat; src: #clip; transparent: true; side: double');
      }
    }
    applyPlane();
    clip.addEventListener('loadedmetadata', applyPlane);

    // วาง ผอ. (+ ดอกบัวที่เท้า) ไว้ตรงหน้าทิศที่มือถือชี้อยู่ตอนเริ่ม
    function placeInFront() {
      if (!camEl || !camEl.object3D) return;
      const q = camEl.object3D.quaternion;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) { fwd.set(0, 0, -1); }
      fwd.normalize();
      director.setAttribute('position',
        (fwd.x * dist).toFixed(2) + ' ' + centerY + ' ' + (fwd.z * dist).toFixed(2));
      log('วาง ผอ. ตรงหน้าแล้ว');
    }

    // ---- เตือนเบราว์เซอร์ที่ใช้ไม่ได้ ----
    if (isIosNonSafari()) {
      showSafariGate();
    } else if (isInAppBrowser()) {
      showBrowserWarning('⚠️ คุณกำลังเปิดผ่านแอป (เช่น LINE)<br>แตะปุ่ม ⋯ มุมขวาบน แล้วเลือก <b>“เปิดในเบราว์เซอร์”</b> (Safari/Chrome)');
    }

    // ---- ปุ่มเริ่ม ----
    let started = false;
    startBtn.addEventListener('click', async function () {
      if (started) return;
      started = true;
      log('แตะเริ่ม');

      // เล่นคลิปพร้อมเสียงในจังหวะแตะ (สำคัญบน iOS)
      clip.muted = !cfg.sound;
      var cp = clip.play();
      if (cp && cp.catch) cp.catch(function () { clip.muted = true; clip.play().catch(function () {}); });

      // ขอสิทธิ์เซ็นเซอร์ทิศทาง (เริ่มในจังหวะแตะเดียวกัน)
      let orientPromise = null;
      try {
        if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
          orientPromise = DeviceOrientationEvent.requestPermission();
        }
      } catch (e) { log('ขอสิทธิ์เซ็นเซอร์ไม่ได้: ' + e); }

      hide(intro);
      show(loading);

      if (orientPromise) {
        try { const p = await orientPromise; log('สิทธิ์เซ็นเซอร์: ' + p); }
        catch (e) { log('สิทธิ์เซ็นเซอร์ error: ' + e); }
      }

      applyPlane();
      setTimeout(placeInFront, 600);

      // ซ่อนตัวโหลดเมื่อคลิปเริ่มเล่น (หรือหลังเวลาสั้น ๆ)
      let done = false;
      function ready() {
        if (done) return; done = true;
        hide(loading); show(hint);
        setTimeout(function () { hide(hint); }, 6000);
        log('✓ เล่นแล้ว');
      }
      clip.addEventListener('playing', ready, { once: true });
      setTimeout(ready, 1800);
    });

    // ================= helpers =================
    function setText(id, txt) {
      const el = document.getElementById(id);
      if (el && txt != null) el.textContent = txt;
    }
    function hide(el) { if (el) el.classList.add('hidden'); }
    function show(el) { if (el) el.classList.remove('hidden'); }

    function isIos() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    function isIosNonSafari() {
      return isIos() && /CriOS|FxiOS|EdgiOS|OPiOS|mercury|YaBrowser|DuckDuckGo/i.test(navigator.userAgent);
    }
    function isInAppBrowser() {
      const ua = navigator.userAgent || '';
      return /Line\/|FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|TikTok|Snapchat|GSA|Twitter/i.test(ua);
    }

    // หน้าเต็ม: บังคับให้เปิดด้วย Safari (สำหรับ Chrome/เบราว์เซอร์อื่นบน iPhone)
    function showSafariGate() {
      if (document.getElementById('safari-gate')) return;
      if (startBtn) startBtn.style.display = 'none';
      const ic = document.querySelector('.icon-cam');
      if (ic) ic.textContent = '🧭';
      setText('app-title', 'กรุณาเปิดด้วย Safari');
      setText('intro-text', 'แอป Chrome บน iPhone เปิดระบบนี้ไม่ได้ (ข้อจำกัดของ iOS) — โปรดเปิดลิงก์นี้ในแอป Safari');

      const box = document.createElement('div');
      box.id = 'safari-gate';
      box.style.cssText = 'margin-top:6px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:16px;font-size:14px;line-height:1.7;max-width:340px;text-align:left;';
      box.innerHTML =
        '<b>วิธีเปิดใน Safari:</b><br>' +
        '1. แตะปุ่ม <b>⋯</b> หรือ <b>แชร์</b> ↗ ของ Chrome<br>' +
        '2. เลือก <b>“เปิดในเบราว์เซอร์ Safari”</b><br>' +
        '<br>หรือกดปุ่มล่างนี้คัดลอกลิงก์ แล้วเปิดแอป <b>Safari</b> เอง วางในช่องที่อยู่';
      const btn = document.createElement('button');
      btn.textContent = '📋 คัดลอกลิงก์';
      btn.style.cssText = 'display:block;margin:18px auto 0;font-family:inherit;font-size:17px;font-weight:700;color:#5a2740;background:#ffd23f;border:none;border-radius:999px;padding:14px 30px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);';
      btn.addEventListener('click', function () {
        const url = location.href.split('?')[0];
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
        btn.textContent = '✓ คัดลอกแล้ว — เปิดแอป Safari แล้ววาง';
      });
      intro.appendChild(box);
      intro.appendChild(btn);
    }

    function showBrowserWarning(html) {
      if (document.getElementById('browser-warn')) return;
      const box = document.createElement('div');
      box.id = 'browser-warn';
      box.style.cssText = 'margin-top:18px;background:rgba(255,90,90,.18);border:1px solid rgba(255,150,150,.6);border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.55;max-width:330px;';
      box.innerHTML = html;
      const btn = document.createElement('button');
      btn.textContent = 'คัดลอกลิงก์';
      btn.style.cssText = 'display:block;margin:12px auto 0;font-family:inherit;font-size:14px;font-weight:700;color:#5a2740;background:#fff;border:none;border-radius:999px;padding:8px 20px;cursor:pointer;';
      btn.addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(function () {});
        btn.textContent = 'คัดลอกแล้ว ✓';
      });
      box.appendChild(btn);
      intro.appendChild(box);
    }
  });
})();
