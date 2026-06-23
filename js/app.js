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

    // ---- เตือนถ้าเปิดผ่านเบราว์เซอร์ที่ใช้ AR ไม่ได้ ----
    if (isInAppBrowser()) {
      showBrowserWarning('⚠️ คุณกำลังเปิดผ่านแอป (เช่น LINE) ซึ่งมักเปิดกล้องไม่ได้<br>แตะปุ่ม ⋯ มุมขวาบน แล้วเลือก <b>“เปิดในเบราว์เซอร์”</b> (Safari/Chrome)');
    } else if (isIosNonSafari()) {
      showBrowserWarning('⚠️ บน iPhone กรุณาเปิดด้วย <b>Safari</b> เท่านั้น<br>(Chrome/แอปอื่นบน iPhone ใช้ AR ไม่ได้) — แตะปุ่ม <b>แชร์</b> ↗ แล้วเลือก <b>“เปิดในแอป Safari”</b>');
    }

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
    let arReady = false;
    sceneEl.addEventListener('arReady', function () {
      arReady = true;
      if (window.__arlog) window.__arlog('✓ AR พร้อม (arReady) — เล็งกล้องไปที่การ์ดได้เลย');
      hide(loading);
      show(scanHint);
    });
    sceneEl.addEventListener('arError', function () {
      if (window.__arlog) window.__arlog('✗ arError — ระบบ AR เริ่มไม่สำเร็จ');
      hide(loading);
      show(intro);
    });

    target.addEventListener('targetFound', function () {
      if (window.__arlog) window.__arlog('🎯 พบเป้าหมาย! กำลังเล่นวิดีโอ');
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
      if (window.__arlog) window.__arlog('แตะปุ่มเริ่ม → กำลังขอสิทธิ์กล้อง...');
      hide(intro);
      show(loading);

      // 1) ขอสิทธิ์กล้องเองก่อน (ใกล้กับการแตะที่สุด) เพื่อรู้สาเหตุชัดเจนถ้าเปิดไม่ได้
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw { name: 'Unsupported' };
        }
        const test = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        test.getTracks().forEach(function (t) { t.stop(); });
        if (window.__arlog) window.__arlog('✓ ได้สิทธิ์กล้องแล้ว → กำลังเริ่มระบบ AR');
      } catch (err) {
        if (window.__arlog) window.__arlog('✗ ขอกล้องไม่สำเร็จ: ' + (err && (err.name + ' ' + (err.message || ''))));
        hide(loading);
        show(intro);
        showCameraError(err);
        return;
      }

      started = true;

      // 2) ปลดล็อกการเล่นวิดีโอ (โดยเฉพาะเสียงบนมือถือ)
      video.muted = !cfg.sound;
      try { await video.play(); video.pause(); video.currentTime = 0; } catch (e) {}

      // 3) เริ่มระบบ AR
      function startSystem() {
        const sys = sceneEl.systems['mindar-image-system'];
        if (!sys) {
          if (window.__arlog) window.__arlog('✗ ไม่พบ mindar-image-system (MindAR ไม่โหลด?)');
          return;
        }
        if (window.__arlog) window.__arlog('เรียก start ระบบ AR แล้ว...');
        sys.start();
        setTimeout(function () {
          if (!arReady && window.__arlog) {
            window.__arlog('⚠️ AR ยังไม่พร้อมใน 10 วิ — ถ้าใช้ Chrome บน iPhone แนะนำให้เปิดด้วย Safari แทน');
          }
        }, 10000);
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

    function isSecureCtx() {
      return window.isSecureContext ||
        location.protocol === 'https:' || location.hostname === 'localhost';
    }

    function isInAppBrowser() {
      const ua = navigator.userAgent || '';
      return /Line\/|FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|TikTok|Snapchat|GSA|Twitter/i.test(ua);
    }

    function isIos() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    // iPhone/iPad ที่ไม่ใช่ Safari (Chrome/Firefox/Edge บน iOS ใช้ WebAR ไม่ได้)
    function isIosNonSafari() {
      return isIos() && /CriOS|FxiOS|EdgiOS|OPiOS|mercury|YaBrowser|DuckDuckGo/i.test(navigator.userAgent);
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
        msg = 'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง — มักเกิดจากเปิดผ่านแอป (LINE/Facebook) กรุณาเปิดลิงก์นี้ใน Safari หรือ Chrome';
      } else if (!isSecureCtx()) {
        msg = 'ต้องเปิดผ่าน HTTPS เท่านั้น (ลิงก์ GitHub Pages เป็น https อยู่แล้ว)';
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
