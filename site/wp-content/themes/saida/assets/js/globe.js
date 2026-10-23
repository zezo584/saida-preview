/* Saida – interactive 3D export globe (Three.js). Data comes from the dashboard (Export countries). */
const nodes = document.querySelectorAll('[data-globe]');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

nodes.forEach((el) => {
  const start = () => init(el).catch((e) => { console.warn('Globe fallback', e); el.classList.add('is-fallback'); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '200px' });
    io.observe(el);
  } else start();
});

async function init(el) {
  const cfg = JSON.parse(el.dataset.globe);
  const abs = (u) => new URL(u, document.baseURI).href;
  ['three', 'controls', 'world'].forEach((k) => { cfg[k] = abs(cfg[k]); });
  cfg.origin.flag = abs(cfg.origin.flag); cfg.countries.forEach((c) => { c.flag = abs(c.flag); });
  const THREE = await import(cfg.three);
  const { OrbitControls } = await import(cfg.controls);
  const holder = el.querySelector('.globe__canvas');
  const tip = el.querySelector('.globe__tip');
  const big = el.classList.contains('globe--big');
  const dark = big;

  const C = { ocean1: dark ? '#1F3C9A' : '#2E51B8', ocean2: dark ? '#0F2470' : '#1A3487', land: '#FFF4E3', landEdge: 'rgba(34,63,148,.25)', export: '#DCAC5B', exportEdge: '#B9862F', origin: '#FF7A1A', grid: 'rgba(255,255,255,.08)' };

  /* ---------- renderer */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  holder.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(-3, 2, 4); scene.add(dl);

  /* ---------- texture */
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.ocean1); g.addColorStop(.5, C.ocean2); g.addColorStop(1, C.ocean1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1.2;
  for (let lon = -180; lon <= 180; lon += 20) { const x = (lon + 180) / 360 * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let lat = -80; lat <= 80; lat += 20) { const y = (90 - lat) / 180 * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const world = await fetch(cfg.world).then((r) => r.json());
  const isoExport = new Set(cfg.countries.map((c) => c.iso));
  const P = ([lon, lat]) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
  const drawPoly = (polys) => {
    ctx.beginPath();
    polys.forEach((poly) => poly.forEach((ring) => { ring.forEach((pt, i) => { const [x, y] = P(pt); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }));
  };
  world.forEach((f) => {
    if (f.i === 'aq') return;
    const ex = isoExport.has(f.i), og = f.i === cfg.origin.iso;
    drawPoly(f.p);
    ctx.fillStyle = og ? C.origin : ex ? C.export : C.land;
    ctx.fill('evenodd');
    ctx.lineWidth = ex || og ? 2 : 1; ctx.strokeStyle = ex ? C.exportEdge : og ? '#C9530A' : C.landEdge; ctx.stroke();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  const globe = new THREE.Group(); scene.add(globe);
  const R = 1;
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshPhongMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.62, shininess: 10, specular: 0x222222 })));

  // atmosphere glow
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.14, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { c: { value: new THREE.Color(dark ? 0x6f8fff : 0x9fb6ff) } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 c; varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.,0.,1.)), 3.); gl_FragColor = vec4(c, 1.) * i; }'
  }));
  scene.add(atmo);

  const toV = (lat, lng, r = R) => {
    const phi = (90 - lat) * Math.PI / 180, th = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };

  /* ---------- markers, flags, arcs */
  const markers = []; const comets = [];
  const loadFlag = (url) => new Promise((res) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 160; c.height = 120; const x = c.getContext('2d');
      x.fillStyle = '#fff'; roundRect(x, 0, 0, 160, 120, 22); x.fill();
      x.save(); roundRect(x, 8, 8, 144, 104, 16); x.clip(); x.drawImage(img, 8, 8, 144, 104); x.restore();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; res(t);
    };
    img.onerror = () => res(null); img.src = url;
  });
  const origin = toV(cfg.origin.lat, cfg.origin.lng);

  const addMarker = async (c, isOrigin) => {
    const pos = toV(c.lat, c.lng, R * 1.003);
    const grp = new THREE.Group(); grp.position.copy(pos); grp.lookAt(pos.clone().multiplyScalar(2));
    const col = isOrigin ? 0xff7a1a : 0xffffff;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(isOrigin ? 0.03 : 0.018, 24), new THREE.MeshBasicMaterial({ color: col }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(isOrigin ? 0.04 : 0.025, isOrigin ? 0.05 : 0.032, 32), new THREE.MeshBasicMaterial({ color: isOrigin ? 0xff7a1a : 0xdcac5b, transparent: true, opacity: .9, side: THREE.DoubleSide }));
    grp.add(dot, ring); globe.add(grp);
    const ft = await loadFlag(c.flag);
    let spr = null;
    if (ft) {
      spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, depthTest: true, transparent: true }));
      const s = isOrigin ? 0.15 : 0.11; spr.scale.set(s, s * 0.75, 1);
      spr.position.copy(toV(c.lat, c.lng, R * 1.09)); globe.add(spr);
    }
    // stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, R * 0.07, 6), new THREE.MeshBasicMaterial({ color: isOrigin ? 0xff7a1a : 0xdcac5b }));
    stem.position.copy(toV(c.lat, c.lng, R * 1.04)); stem.lookAt(new THREE.Vector3()); stem.rotateX(Math.PI / 2); globe.add(stem);
    markers.push({ c, isOrigin, grp, ring, dot, spr, pos });
    if (!isOrigin) {
      const end = toV(c.lat, c.lng);
      const dist = origin.distanceTo(end);
      const mid = origin.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(R + dist * 0.38);
      const curve = new THREE.QuadraticBezierCurve3(origin.clone(), mid, end);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.0035, 6, false), new THREE.MeshBasicMaterial({ color: 0xdcac5b, transparent: true, opacity: .75 }));
      globe.add(tube);
      const comet = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      globe.add(comet); comets.push({ curve, comet, t: Math.random() });
    }
  };
  await addMarker(cfg.origin, true);
  await Promise.all(cfg.countries.map((c) => addMarker(c, false)));

  /* ---------- controls */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.enablePan = false; controls.enableZoom = big; controls.minDistance = 2.6; controls.maxDistance = 6;
  controls.rotateSpeed = 0.55; controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.55;
  if (!big) renderer.domElement.style.touchAction = 'pan-y';
  // start facing Egypt
  const face = (lat, lng, dist) => toV(lat, lng, dist || camera.position.length());
  camera.position.copy(face(cfg.origin.lat - 8, cfg.origin.lng - 10, 4.4));
  let idleT = null;
  controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idleT); });
  controls.addEventListener('end', () => { clearTimeout(idleT); idleT = setTimeout(() => { controls.autoRotate = !reduce; }, 5000); });

  /* ---------- fly to a country */
  let fly = null, active = null;
  const flyTo = (iso) => {
    const m = markers.find((k) => k.c.iso === iso) || (iso === cfg.origin.iso ? markers[0] : null);
    if (!m) return;
    controls.autoRotate = false; clearTimeout(idleT);
    const from = camera.position.clone(), to = face(m.c.lat, m.c.lng, Math.min(camera.position.length(), big ? 3.4 : 4.2));
    fly = { from, to, t0: performance.now(), dur: reduce ? 1 : 1300, m };
    active = m;
    idleT = setTimeout(() => { controls.autoRotate = !reduce; active = null; }, 9000);
  };
  window.addEventListener('saida:fly', (e) => flyTo(e.detail));

  /* ---------- hover / tap */
  const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let hover = null;
  const pick = (ev) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const objs = []; markers.forEach((m) => { objs.push(m.dot, m.ring); if (m.spr) objs.push(m.spr); });
    const hit = ray.intersectObjects(objs, false)[0];
    return hit ? markers.find((m) => m.dot === hit.object || m.ring === hit.object || m.spr === hit.object) : null;
  };
  renderer.domElement.addEventListener('pointermove', (ev) => { hover = pick(ev); renderer.domElement.style.cursor = hover ? 'pointer' : ''; });
  renderer.domElement.addEventListener('pointerleave', () => { hover = null; });
  renderer.domElement.addEventListener('click', (ev) => { const m = pick(ev); if (m) flyTo(m.c.iso); });

  const showTip = (m) => {
    if (!m) { tip.classList.remove('is-on'); return; }
    const wp = m.pos.clone().applyMatrix4(globe.matrixWorld);
    const facing = wp.clone().normalize().dot(camera.position.clone().normalize()) > 0.15;
    if (!facing) { tip.classList.remove('is-on'); return; }
    const v = wp.clone().project(camera);
    const r = holder.getBoundingClientRect();
    const x = (v.x + 1) / 2 * r.width, y = (1 - v.y) / 2 * r.height;
    const html = '<img src="' + m.c.flag + '" alt=""><span>' + esc(m.c.name) + '<small>' + esc(m.isOrigin ? cfg.labels.factory : (m.c.note || cfg.labels.exports)) + '</small></span>';
    if (tip.dataset.k !== m.c.iso) { tip.innerHTML = html; tip.dataset.k = m.c.iso; }
    tip.style.left = x + 'px'; tip.style.top = (y - 26) + 'px';
    tip.classList.add('is-on');
  };

  /* ---------- size & loop */
  const size = () => { const w = holder.clientWidth, h = holder.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); new ResizeObserver(size).observe(holder);
  let visible = true;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) loop(); }).observe(el);
  const clock = new THREE.Clock();
  let raf = 0;
  function loop() {
    cancelAnimationFrame(raf);
    if (!visible) return;
    raf = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    if (fly) {
      const p = Math.min(1, (performance.now() - fly.t0) / fly.dur), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const len = fly.from.length() + (fly.to.length() - fly.from.length()) * e;
      camera.position.copy(fly.from.clone().normalize().lerp(fly.to.clone().normalize(), e).normalize().multiplyScalar(len));
      if (p >= 1) fly = null;
    }
    controls.update();
    markers.forEach((m, i) => {
      const s = 1 + 0.35 * Math.sin(t * 2.4 + i);
      m.ring.scale.set(s, s, s); m.ring.material.opacity = 0.9 - (s - 1) * 1.6;
      if (m.spr) {
        const wp = m.spr.position.clone().applyMatrix4(globe.matrixWorld);
        m.spr.material.opacity = wp.normalize().dot(camera.position.clone().normalize()) > 0.1 ? 1 : 0;
      }
    });
    comets.forEach((c) => { c.t = (c.t + 0.004) % 1; c.comet.position.copy(c.curve.getPoint(c.t)); });
    showTip(hover || active);
    renderer.render(scene, camera);
  }
  loop();
  el.classList.add('is-ready');
}

function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
