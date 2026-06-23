/* ============================================================
 *  markerless.js — โหมด AR ไม่ต้องส่องป้าย
 *  สแกน QR → เปิดกล้อง → คลิป ผอ. ลอยทับภาพกล้องทันที
 *  (chromaKey: true = ตัดฉากเขียวออก ให้เห็น ผอ. ยืนลอยในห้องจริง)
 * ========================================================== */
(function () {
  const cfg = window.AR_CONFIG || {};

  document.addEventListener('DOMContentLoaded', function () {
    const camera  = document.getElementById('camera');
    const clip    = document.getElementById('clip');
    const canvas  = document.getElementById('clip-canvas');
    const intro   = document.getElementById('intro');
    const loading = document.getElementById('loading');
    const hint    = document.getElementById('hint');
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

    // ---- ตำแหน่ง/ขนาดคลิปบนจอ ----
    const clipCfg = cfg.clip || {};
    const widthPct  = clipCfg.widthPercent != null ? clipCfg.widthPercent : 80;
    const bottomPct = clipCfg.bottomPercent != null ? clipCfg.bottomPercent : 2;
    const align = clipCfg.align || 'center';
    [clip, canvas].forEach(function (el) {
      el.style.width = widthPct + 'vw';
      el.style.bottom = bottomPct + 'vh';
      if (align === 'left') { el.style.left = '3vw'; }
      else if (align === 'right') { el.style.right = '3vw'; }
      else { el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; }
    });

    // ใช้ canvas เมื่อเปิดโหมดตัดฉากเขียว
    if (cfg.chromaKey) {
      clip.classList.add('hidden');
      canvas.classList.remove('hidden');
    }
    clip.addEventListener('loadedmetadata', function () {
      if (clip.videoWidth) { canvas.width = clip.videoWidth; canvas.height = clip.videoHeight; }
    });

    // ---- เตือนเบราว์เซอร์ที่ใช้ไม่ได้ ----
    if (isInAppBrowser()) {
      showBrowserWarning('⚠️ คุณกำลังเปิดผ่านแอป (เช่น LINE) ซึ่งมักเปิดกล้องไม่ได้<br>แตะปุ่ม ⋯ มุมขวาบน แล้วเลือก <b>“เปิดในเบราว์เซอร์”</b> (Safari/Chrome)');
    } else if (isIosNonSafari()) {
      showBrowserWarning('⚠️ บน iPhone กรุณาเปิดด้วย <b>Safari</b><br>แตะปุ่ม <b>แชร์</b> ↗ แล้วเลือก <b>“เปิดในแอป Safari”</b>');
    }

    // ---- ปุ่มเริ่ม ----
    let started = false;
    startBtn.addEventListener('click', async function () {
      if (started) return;
      if (window.__arlog) window.__arlog('แตะเริ่ม → กำลังขอกล้อง...');
      hide(intro);
      show(loading);

      // 1) ขอกล้องหลัง
      let stream;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw { name: 'Unsupported' };
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }, audio: false,
        });
      } catch (err) {
        if (window.__arlog) window.__arlog('✗ กล้อง: ' + (err && (err.name + ' ' + (err.message || ''))));
        hide(loading); show(intro); showCameraError(err);
        return;
      }
      started = true;
      camera.srcObject = stream;
      try { await camera.play(); } catch (e) {}
      if (window.__arlog) window.__arlog('✓ กล้องเปิดแล้ว');

      // 2) เล่นคลิป ผอ. (ปลดล็อกเสียงในจังหวะแตะ)
      clip.muted = !cfg.sound;
      try {
        await clip.play();
      } catch (e) {
        clip.muted = true;                 // ถ้าเล่นพร้อมเสียงไม่ได้ ให้เล่นแบบเงียบไปก่อน
        try { await clip.play(); } catch (e2) {}
      }
      if (window.__arlog) window.__arlog('✓ คลิปเริ่มเล่น (เสียง: ' + (!clip.muted) + ')');

      // 3) ตัดฉากเขียว (ถ้าเปิด)
      if (cfg.chromaKey) startChroma();

      hide(loading);
      show(hint);
      setTimeout(function () { hide(hint); }, 4500);
    });

    // ================= WebGL chroma compositor =================
    function startChroma() {
      const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: true })
              || canvas.getContext('experimental-webgl', { premultipliedAlpha: false, alpha: true });
      if (!gl) {
        if (window.__arlog) window.__arlog('⚠️ ไม่มี WebGL — แสดงคลิปแบบสี่เหลี่ยมแทน');
        canvas.classList.add('hidden'); clip.classList.remove('hidden');
        return;
      }

      const vs = 'attribute vec2 p; varying vec2 vUv;' +
        'void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }';
      const fs =
        'precision mediump float;' +
        'uniform sampler2D map; uniform vec3 keyColor;' +
        'uniform float similarity; uniform float smoothness; varying vec2 vUv;' +
        'vec2 RGBtoUV(vec3 c){ return vec2(' +
        '  c.r*-0.169 + c.g*-0.331 + c.b*0.5   + 0.5,' +
        '  c.r*0.5    + c.g*-0.419 + c.b*-0.081 + 0.5 ); }' +
        'void main(){' +
        '  vec4 col = texture2D(map, vUv);' +
        '  float d = distance(RGBtoUV(col.rgb), RGBtoUV(keyColor));' +
        '  float a = smoothstep(similarity, similarity+smoothness, d);' +
        '  gl_FragColor = vec4(col.rgb, col.a*a);' +
        '}';

      const prog = makeProgram(gl, vs, fs);
      if (!prog) { canvas.classList.add('hidden'); clip.classList.remove('hidden'); return; }
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      const c = hexToRgb(cfg.chromaColor || '#00d400');
      gl.uniform3f(gl.getUniformLocation(prog, 'keyColor'), c[0], c[1], c[2]);
      gl.uniform1f(gl.getUniformLocation(prog, 'similarity'), cfg.chromaSimilarity != null ? cfg.chromaSimilarity : 0.4);
      gl.uniform1f(gl.getUniformLocation(prog, 'smoothness'), cfg.chromaSmoothness != null ? cfg.chromaSmoothness : 0.1);
      gl.clearColor(0, 0, 0, 0);

      function frame() {
        if (clip.readyState >= 2 && clip.videoWidth) {
          if (canvas.width !== clip.videoWidth) {
            canvas.width = clip.videoWidth; canvas.height = clip.videoHeight;
          }
          gl.viewport(0, 0, canvas.width, canvas.height);
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, clip); } catch (e) {}
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        requestAnimationFrame(frame);
      }
      frame();
    }

    function makeProgram(gl, vsSrc, fsSrc) {
      function sh(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          if (window.__arlog) window.__arlog('shader error: ' + gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      }
      const v = sh(gl.VERTEX_SHADER, vsSrc), f = sh(gl.FRAGMENT_SHADER, fsSrc);
      if (!v || !f) return null;
      const p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
      return p;
    }

    function hexToRgb(hex) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
      return m ? [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255] : [0, 0.83, 0];
    }

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
