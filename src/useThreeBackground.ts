import { useEffect, useRef } from 'react';

type Theme = 'dark' | 'light';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isLowPowerDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || prefersReducedMotion();
}

function safeWebGLRenderer(THREE: any): any | null {
  if (!THREE) return null;
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: !isLowPowerDevice(),
      alpha: true,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
      preserveDrawingBuffer: false,
    });
    if (!renderer.getContext()) {
      renderer.dispose();
      return null;
    }
    return renderer;
  } catch {
    return null;
  }
}

type ThreeInstance = {
  renderer: any;
  scene: any;
  camera: any;
  ptMat: any;
  lineMat: any;
  shapeMats: any[];
  ringMat: any;
  ring2Mat: any;
  ptGeo: any;
  lineGeo: any;
  connections: [number, number][];
  meshes: any[];
  velocities: number[];
  particleCount: number;
  linePos: any;
};

const LINE_THRESHOLD = 4.2;
const MAX_NEIGHBORS = 2;

/** روابط بين الجسيمات القريبة فقط — تمنع الخطوط الطويلة المتقاطعة */
function buildProximityConnections(positions: number[], count: number): [number, number][] {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const near: { j: number; d: number }[] = [];
    const ax = positions[i * 3];
    const ay = positions[i * 3 + 1];
    const az = positions[i * 3 + 2];
    for (let j = i + 1; j < count; j++) {
      const dx = ax - positions[j * 3];
      const dy = ay - positions[j * 3 + 1];
      const dz = az - positions[j * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= LINE_THRESHOLD * 1.15) near.push({ j, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (let k = 0; k < Math.min(MAX_NEIGHBORS, near.length); k++) {
      const j = near[k].j;
      const key = `${i}-${j}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}

function applyThemeColors(inst: ThreeInstance, isDark: boolean) {
  const { THREE } = window;
  if (!THREE) return;
  inst.ptMat.color.setHex(isDark ? 0x4488ff : 0x1144cc);
  inst.ptMat.opacity = isDark ? 0.75 : 0.85;
  inst.lineMat.color.setHex(isDark ? 0x1144aa : 0x2255bb);
  inst.lineMat.opacity = isDark ? 0.12 : 0.2;
  const shapeColor = isDark ? 0x2266ff : 0x1155bb;
  const shapeOp = isDark ? 0.35 : 0.5;
  inst.shapeMats.forEach(m => { m.color.setHex(shapeColor); m.opacity = shapeOp; });
  inst.ringMat.color.setHex(isDark ? 0x1155cc : 0x2266cc);
  inst.ringMat.opacity = isDark ? 0.3 : 0.4;
  inst.ring2Mat.color.setHex(isDark ? 0x3377ff : 0x4488dd);
  inst.ring2Mat.opacity = isDark ? 0.14 : 0.22;
  if (isDark) inst.scene.fog = new THREE.FogExp2(0x000c1a, 0.032);
  else inst.scene.fog = null;
}

function disposeThreeInstance(inst: ThreeInstance | null, container: HTMLElement | null) {
  if (!inst) return;
  try {
    const cv = inst.renderer.domElement;
    if (cv?.parentNode) cv.parentNode.removeChild(cv);
    inst.renderer.dispose();
    inst.ptGeo.dispose();
    inst.ptMat.dispose();
    inst.lineGeo.dispose();
    inst.lineMat.dispose();
    inst.shapeMats.forEach(m => m.dispose());
    inst.ringMat.dispose();
    inst.ring2Mat.dispose();
  } catch { /* ignore */ }
  if (container) container.classList.add('three-fallback');
}

/** خلفية Three.js — مُحسّنة ضد تعليق WebGL والشاشة البيضاء */
export function useThreeBackground(
  containerRef: React.RefObject<HTMLDivElement | null>,
  theme: Theme,
) {
  const instRef = useRef<ThreeInstance | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  /* إنشاء المشهد مرة واحدة فقط — لا نعيد إنشاء WebGL عند تغيير الثيم */
  useEffect(() => {
    const THREE = window.THREE;
    const container = containerRef.current;
    if (!THREE || !container) return;

    if (prefersReducedMotion()) {
      container.classList.add('three-fallback');
      return;
    }

    const renderer = safeWebGLRenderer(THREE);
    if (!renderer) {
      container.classList.add('three-fallback');
      return;
    }
    container.classList.remove('three-fallback');

    const isDark = themeRef.current === 'dark';
    const mobile = isLowPowerDevice();
    const PARTICLE_COUNT = mobile ? 80 : 160;

    let rafId = 0;
    let alive = true;
    let tabVisible = document.visibilityState === 'visible';
    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    const scene = new THREE.Scene();
    if (isDark) scene.fog = new THREE.FogExp2(0x000c1a, 0.032);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 12);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const positions: number[] = [];
    const velocities: number[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = 10 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
      velocities.push(
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.006,
      );
    }

    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const ptMat = new THREE.PointsMaterial({
      color: isDark ? 0x4488ff : 0x1144cc,
      size: 0.12,
      transparent: true,
      opacity: isDark ? 0.75 : 0.85,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(ptGeo, ptMat));

    /* جسيمات موزّعة في كرة — روابط قريبة فقط (شبكة عضوية بدون تقاطعات طويلة) */
    const connections = buildProximityConnections(positions, PARTICLE_COUNT);
    const linePosArr = new Float32Array(Math.max(connections.length, 1) * 6);
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new THREE.BufferAttribute(linePosArr, 3);
    lineGeo.setAttribute('position', linePos);
    const lineMat = new THREE.LineBasicMaterial({
      color: isDark ? 0x1144aa : 0x2255bb,
      transparent: true,
      opacity: isDark ? 0.12 : 0.2,
      depthWrite: false,
    });
    scene.add(new THREE.LineSegments(lineGeo, lineMat));

    const shapeMats: any[] = [];
    const meshes: any[] = [];
    const shapeDefs = [
      { geo: new THREE.IcosahedronGeometry(1.4, mobile ? 0 : 1), x: 4, y: 2, z: -2 },
      { geo: new THREE.OctahedronGeometry(0.9, mobile ? 0 : 1), x: -4.5, y: -1.5, z: -1 },
      ...(mobile ? [] : [
        { geo: new THREE.TetrahedronGeometry(0.7, 0), x: 3, y: -3, z: 2 },
        { geo: new THREE.IcosahedronGeometry(0.6, 0), x: -2.5, y: 3, z: 1 },
      ]),
    ];
    shapeDefs.forEach(def => {
      const mat2 = new THREE.LineBasicMaterial({
        color: isDark ? 0x2266ff : 0x1155bb,
        transparent: true,
        opacity: isDark ? 0.35 : 0.5,
      });
      shapeMats.push(mat2);
      const mesh = new THREE.LineSegments(new THREE.EdgesGeometry(def.geo), mat2);
      mesh.position.set(def.x, def.y, def.z);
      scene.add(mesh);
      meshes.push(mesh);
    });

    const ringMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x1155cc : 0x2266cc,
      transparent: true,
      opacity: isDark ? 0.3 : 0.4,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.014, 8, mobile ? 64 : 96), ringMat);
    ring.rotation.x = Math.PI / 3;
    scene.add(ring);

    const ring2Mat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x3377ff : 0x4488dd,
      transparent: true,
      opacity: isDark ? 0.14 : 0.22,
    });
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.01, 8, mobile ? 48 : 72), ring2Mat);
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.z = Math.PI / 6;
    scene.add(ring2);

    const inst: ThreeInstance = {
      renderer, scene, camera, ptMat, lineMat, shapeMats, ringMat, ring2Mat,
      ptGeo, lineGeo, connections, meshes, velocities, particleCount: PARTICLE_COUNT, linePos,
    };
    instRef.current = inst;

    let t = 0;
    const animate = () => {
      if (!alive || !tabVisible) return;
      rafId = requestAnimationFrame(animate);
      try {
        t += 0.005;
        const pa = ptGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          pa[i * 3] += velocities[i * 3];
          pa[i * 3 + 1] += velocities[i * 3 + 1];
          pa[i * 3 + 2] += velocities[i * 3 + 2];
          const dist = Math.sqrt(pa[i * 3] ** 2 + pa[i * 3 + 1] ** 2 + pa[i * 3 + 2] ** 2);
          if (dist > 16) {
            pa[i * 3] *= 0.97;
            pa[i * 3 + 1] *= 0.97;
            pa[i * 3 + 2] *= 0.97;
          }
        }
        ptGeo.attributes.position.needsUpdate = true;

        let lineIdx = 0;
        let segCount = 0;
        const la = linePos.array as Float32Array;
        const threshSq = LINE_THRESHOLD * LINE_THRESHOLD;
        for (const [i, j] of connections) {
          const dx = pa[i * 3] - pa[j * 3];
          const dy = pa[i * 3 + 1] - pa[j * 3 + 1];
          const dz = pa[i * 3 + 2] - pa[j * 3 + 2];
          if (dx * dx + dy * dy + dz * dz > threshSq) continue;
          la[lineIdx++] = pa[i * 3];
          la[lineIdx++] = pa[i * 3 + 1];
          la[lineIdx++] = pa[i * 3 + 2];
          la[lineIdx++] = pa[j * 3];
          la[lineIdx++] = pa[j * 3 + 1];
          la[lineIdx++] = pa[j * 3 + 2];
          segCount++;
        }
        lineGeo.setDrawRange(0, segCount);
        linePos.needsUpdate = true;

        meshes.forEach((m, idx) => {
          m.rotation.x += 0.003 + idx * 0.0008;
          m.rotation.y += 0.004 + idx * 0.0006;
          m.position.y += Math.sin(t + idx) * 0.003;
        });
        ring.rotation.z += 0.002;
        ring2.rotation.y += 0.0015;
        camera.position.x += (mouseX * 1.2 - camera.position.x) * 0.02;
        camera.position.y += (-mouseY * 0.8 - camera.position.y) * 0.02;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      } catch {
        alive = false;
        disposeThreeInstance(instRef.current, container);
        instRef.current = null;
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      alive = false;
      cancelAnimationFrame(rafId);
      disposeThreeInstance(instRef.current, container);
      instRef.current = null;
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', onContextLost);

    const onVisibility = () => {
      tabVisible = document.visibilityState === 'visible';
      if (tabVisible && alive) animate();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    animate();

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      disposeThreeInstance(instRef.current, container);
      instRef.current = null;
    };
  }, [containerRef]);

  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    applyThemeColors(inst, theme === 'dark');
  }, [theme]);
}
