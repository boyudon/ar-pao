/* ============================================================
 *  markerless.js — โหมด AR ไม่ต้องส่องป้าย (เกาะโลกจริงด้วยไจโร)
 *  สแกน QR → เปิดกล้อง → คลิป ผอ. เกาะตำแหน่งในห้อง
 *  หมุน/ส่ายมือถือ → มอง ผอ. ได้รอบทิศ (3DOF)
 *  chromaKey: true = ตัดฉากเขียวออก ให้เห็น ผอ. ยืนลอยในห้องจริง
 * ========================================================== */
(function () {
  // คอมโพเนนต์: ให้ระนาบหันเข้าหากล้องเสมอ (เฉพาะแกนแนวนอน)
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
    const camera   = document.getElementById('camera');
    const clip     = document.getElementById('clip');
    const director = document.getElementById('director');
    const plane    = document.getElementById('director-plane');
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

    // ---- แหล่งวิดีโอคลิป ----
    if (cfg.videoSrc) clip.setAttribute('src', cfg.videoSrc);

    // ---- การวางในโลกจริง ----
    const w = cfg.world || {};
    const dist = w.distanceMeters != null ? w.distanceMeters : 3;
    const H    = w.heightMeters   != null ? w.heightMeters   : 1.9;
    const yOff = w.yOffset        != null ? w.yOffset         : 0;
    const centerY = yOff + H / 2;
    director.setAttribute('position', '0 ' + centerY + ' ' + (-dist));
    if (w.faceUser !== false) director.setAttribute('billboard-yaw', '');

    function applyPlane() {
      const aspect = (clip.videoWidth && clip.videoHeight)
        ? (clip.videoWidth / clip.videoHeight) : (9 / 16);
      const width = H * aspect;
      if (cfg.chromaKey) {
        plane.removeAttribute('material');
        plane.removeAttribute('geometry');
        plane.setAttribute('chromakey-material',
          'src: #clip;' +
          ' color: ' + (cfg.chromaColor || '#00d400') + ';' +
          ' similarity: ' + (cfg.chromaSimilarity != null ? cfg.chromaSimilarity : 0.4) + ';' +
          ' smoothness: ' + (cfg.chromaSmoothness != null ? cfg.chromaSmoothness : 0.1) + ';' +
          ' width: ' + width + '; height: ' + H);
      } else {
        plane.setAttribute('geometry', 'primitive: plane; width: ' + width + '; height: ' + H);
        plane.setAttribute('material', 'shader: flat; src: #clip; transparent: true; side: double');
      }
    }
    applyPlane();
    clip.addEventListener('loadedmetadata', applyPlane);

    // วาง ผอ. ไว้ "ตรงหน้า" ทิศที่มือถือชี้อยู่ตอนเริ่ม (หลังเซ็นเซอร์ทำงานแล้ว)
    function placeInFront() {
      if (!camEl || !camEl.object3D) return;
      const q = camEl.object3D.quaternion;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) { fwd.set(0, 0, -1); }
      fwd.normalize();
      director.setAttribute('position',
        (fwd.x * dist) + ' ' + centerY + ' ' + (fwd.z * dist));
      log('วาง ผอ. ตรงหน้าแล้ว');
    }

    // ---- เตือนเบราว์เซอร์ที่ใช้ไม่ได้ ----
    if (isIosNonSafari()) {
      // Chrome/Firefox/Edge บน iPhone ใช้ AR ไม่ได้ → กั้นด้วยหน้าเต็มให้ไป Safari
      showSafariGate();
    } else if (isInAppBrowser()) {
      showBrowserWarning('⚠️ คุณกำลังเปิดผ่านแอป (เช่น LINE) ซึ่งมักเปิดกล้องไม่ได้<br>แตะปุ่ม ⋯ มุมขวาบน แล้วเลือก <b>“เปิดในเบราว์เซอร์”</b> (Safari/Chrome)');
    }

    // ---- ปุ่มเริ่ม ----
    let started = false;
    startBtn.addEventListener('click', async function () {
      if (started) return;
      log('แตะเริ่ม...');

      // ⚠️ สำคัญบน iOS Safari: ต้อง "เริ่ม" ขอกล้องเป็นอันดับแรกสุด ห้ามมี await มาคั่นก่อน
      //    (ถ้า await อย่างอื่นก่อน การแตะจะหมดอายุ แล้วกล้องจะเปิดไม่ได้)
      let camPromise = null, camInitErr = null;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw { name: 'Unsupported' };
        camPromise = navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }, audio: false,
        });
      } catch (e) { camInitErr = e; }

      // เริ่มขอสิทธิ์เซ็นเซอร์ในจังหวะแตะเดียวกัน (ยังไม่ await)
      let orientPromise = null;
      try {
        if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
          orientPromise = DeviceOrientationEvent.requestPermission();
        }
      } catch (e) { log('เริ่มขอสิทธิ์เซ็นเซอร์ไม่ได้: ' + e); }

      // ปลดล็อก+เล่นคลิป "พร้อมเสียง" ในจังหวะแตะ (สำคัญบน iOS ไม่งั้นจะเล่นแบบเงียบ)
      clip.muted = !cfg.sound;
      var clipPlay = clip.play();
      if (clipPlay && clipPlay.catch) {
        clipPlay.catch(function () {           // ถ้าเล่นพร้อมเสียงไม่ได้ อย่างน้อยให้ภาพเล่น
          clip.muted = true; clip.play().catch(function () {});
        });
      }

      hide(intro);
      show(loading);

      // กล้อง (รอผลทีหลังได้ เพราะเริ่มไปแล้วในจังหวะแตะ)
      let stream;
      try {
        if (camInitErr) throw camInitErr;
        stream = await camPromise;
      } catch (err) {
        log('✗ กล้อง: ' + (err && (err.name + ' ' + (err.message || ''))));
        hide(loading); show(intro); showCameraError(err);
        return;
      }
      started = true;
      camera.srcObject = stream;
      try { await camera.play(); } catch (e) {}
      log('✓ กล้องเปิดแล้ว');

      // สิทธิ์เซ็นเซอร์ทิศทาง (best-effort ไม่ขวางกล้อง)
      if (orientPromise) {
        try { const p = await orientPromise; log('สิทธิ์เซ็นเซอร์: ' + p); }
        catch (e) { log('สิทธิ์เซ็นเซอร์ error: ' + e); }
      }

      // คลิปถูกสั่งเล่นไปแล้วในจังหวะแตะ — แค่ปรับระนาบให้พอดี
      applyPlane();
      log('✓ คลิปเริ่มเล่น (เสียง: ' + (!clip.muted) + ')');

      // 4) วาง ผอ. ตรงหน้า หลังเซ็นเซอร์เริ่มทำงาน
      setTimeout(placeInFront, 600);

      hide(loading);
      show(hint);
      setTimeout(function () { hide(hint); }, 5000);
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
      setText('intro-text', 'แอป Chrome บน iPhone เปิดระบบ AR ไม่ได้ (ข้อจำกัดของ iOS) — โปรดเปิดลิงก์นี้ในแอป Safari');

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
      btn.style.cssText = 'display:block;margin:18px auto 0;font-family:inherit;font-size:17px;font-weight:700;color:#0b1f3a;background:#ffd23f;border:none;border-radius:999px;padding:14px 30px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);';
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
      btn.style.cssText = 'display:block;margin:12px auto 0;font-family:inherit;font-size:14px;font-weight:700;color:#0b1f3a;background:#fff;border:none;border-radius:999px;padding:8px 20px;cursor:pointer;';
      btn.addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(function () {});
        btn.textContent = 'คัดลอกแล้ว ✓';
      });
      box.appendChild(btn);
      intro.appendChild(box);
    }

    function showCameraError(err) {
      let msg;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || (err && err.name === 'Unsupported')) {
        msg = 'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง — มักเกิดจากเปิดผ่านแอป (LINE/Facebook) กรุณาเปิดใน Safari (iPhone) หรือ Chrome (Android)';
      } else {
        switch (err && err.name) {
          case 'NotAllowedError':
          case 'SecurityError':
            msg = 'ถูกปฏิเสธสิทธิ์กล้อง — กรุณาอนุญาตกล้องให้เว็บนี้ในการตั้งค่า แล้วลองใหม่'; break;
          case 'NotFoundError':
          case 'OverconstrainedError':
            msg = 'ไม่พบกล้องหลังของเครื่อง'; break;
          case 'NotReadableError':
            msg = 'กล้องกำลังถูกใช้งานโดยแอปอื่น — ปิดแอปกล้อง/วิดีโอคอลแล้วลองใหม่'; break;
          default:
            msg = 'เปิดกล้องไม่สำเร็จ: ' + ((err && (err.name + ' ' + (err.message || ''))) || 'ไม่ทราบสาเหตุ');
        }
      }
      let el = document.getElementById('cam-error');
      if (!el) {
        el = document.createElement('div');
        el.id = 'cam-error';
        el.style.cssText = 'margin-top:16px;background:rgba(255,90,90,.2);border:1px solid rgba(255,150,150,.6);border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.55;max-width:330px;';
        intro.appendChild(el);
      }
      el.textContent = '⚠️ ' + msg;
    }
  });
})();
