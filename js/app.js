/* ============================================================
 *  app.js — ควบคุมการทำงานของหน้า AR
 * ========================================================== */
(function () {
  const cfg = window.AR_CONFIG || {};

  document.addEventListener('DOMContentLoaded', function () {
    const sceneEl  = document.getElementById('ar-scene');
    const video    = document.getElementById('director-video');
    const plane    = document.getElementById('director-plane');
    const target   = document.getElementById('director-target');
    const intro    = document.getElementById('intro');
    const loading  = document.getElementById('loading');
    const scanHint = document.getElementById('scan-hint');
    const startBtn = document.getElementById('start-btn');

    // ---- เติมข้อความจาก config ลงหน้าจอ ----
    const ui = cfg.ui || {};
    setText('org-name', ui.orgName);
    setText('app-title', ui.title);
    setText('intro-text', ui.intro);
    setText('start-btn', ui.startButton);
    setText('scan-text', ui.scanText);
    setText('loading-text', ui.loadingText);

    // ---- ปรับขนาด/วัสดุของวิดีโอให้พอดีกับเป้าหมาย ----
    let planeReady = false;
    function applyPlane() {
      const haveSize = video.videoWidth && video.videoHeight;
      const aspect = haveSize ? (video.videoWidth / video.videoHeight) : (16 / 9);
      const w = (cfg.videoWidth != null) ? cfg.videoWidth : 1;
      const h = (cfg.videoHeight != null) ? cfg.videoHeight : (w / aspect);

      if (cfg.chromaKey) {
        plane.removeAttribute('material');
        plane.removeAttribute('geometry');
        plane.setAttribute('chromakey-material',
          'src: #director-video;' +
          ' color: ' + (cfg.chromaColor || '#00d400') + ';' +
          ' similarity: ' + (cfg.chromaSimilarity != null ? cfg.chromaSimilarity : 0.4) + ';' +
          ' smoothness: ' + (cfg.chromaSmoothness != null ? cfg.chromaSmoothness : 0.1) + ';' +
          ' width: ' + w + '; height: ' + h);
      } else {
        plane.setAttribute('geometry', 'primitive: plane; width: ' + w + '; height: ' + h);
        plane.setAttribute('material',
          'shader: flat; src: #director-video; transparent: true; side: double');
      }
      plane.setAttribute('position', cfg.videoPosition || '0 0 0');
      plane.setAttribute('rotation', cfg.videoRotation || '0 0 0');
      planeReady = true;
    }

    video.addEventListener('loadedmetadata', applyPlane);
    video.addEventListener('loadeddata', applyPlane);
    if (video.readyState >= 1) applyPlane();

    // ---- เหตุการณ์ของ MindAR ----
    sceneEl.addEventListener('arReady', function () {
      hide(loading);
      show(scanHint);
    });
    sceneEl.addEventListener('arError', function () {
      hide(loading);
      show(intro);
      alert('ไม่สามารถเริ่มกล้อง/ระบบ AR ได้ กรุณาเปิดผ่าน HTTPS และอนุญาตการใช้กล้อง');
    });

    target.addEventListener('targetFound', function () {
      hide(scanHint);
      if (!planeReady) applyPlane();
      video.play().catch(function () {});
    });
    target.addEventListener('targetLost', function () {
      show(scanHint);
      video.pause();
    });

    // ---- ปุ่มเริ่ม (ต้องเป็นการแตะของผู้ใช้ เพื่อปลดล็อกเสียง/กล้อง) ----
    let started = false;
    startBtn.addEventListener('click', async function () {
      if (started) return;
      started = true;

      hide(intro);
      show(loading);

      // ปลดล็อกการเล่นวิดีโอ (โดยเฉพาะเสียงบนมือถือ)
      video.muted = !cfg.sound;
      try { await video.play(); video.pause(); video.currentTime = 0; } catch (e) {}

      function startSystem() {
        const sys = sceneEl.systems['mindar-image-system'];
        if (sys) { sys.start(); }
      }
      if (sceneEl.hasLoaded) startSystem();
      else sceneEl.addEventListener('loaded', startSystem, { once: true });
    });

    // ---- helper ----
    function setText(id, txt) {
      const el = document.getElementById(id);
      if (el && txt != null) el.textContent = txt;
    }
    function hide(el) { if (el) el.classList.add('hidden'); }
    function show(el) { if (el) el.classList.remove('hidden'); }
  });
})();
