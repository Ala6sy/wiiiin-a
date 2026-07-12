import { useEffect, useRef, useState } from 'react';
import type { GfxCameraPose, GfxModel3dSettings } from './gfxModel3d';
import {
  ensureThreeModelLoaders,
  ensureOrbitControls,
  mergeGfxModel3dSettings,
  applyCameraPose,
  capturePoseFromControls,
  syncControlsFromSettings,
  cameraPoseVectors,
  hasSavedOrbitPose,
  ORBIT_DIST_MIN,
  ORBIT_DIST_MAX,
} from './gfxModel3d';
import { detectModelFormat, detectModelFormatFromBuffer, resolveModelPlaybackSrc } from './mediaUrl';

type GfxModelViewerProps = {
  url: string;
  settings?: GfxModel3dSettings | null;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  /** جودة أعلى في لوحة الإدارة */
  interactive?: boolean;
  /** تدوير/تقريب/إبعاد للزائر (كمبيوتر + جوال) */
  allowUserControl?: boolean;
  /** عند السحب في المعاينة — حفظ زاوية الكاميرا في الإعدادات */
  capturePose?: boolean;
  /** زيادة القيمة لحفظ المنظور الحالي (لوحة الإدارة) */
  savePoseTick?: number;
  /** بعد حفظ المنظور — قفل الكاميرا حتى يحرّكها المستخدم */
  poseLockTick?: number;
  /** تحريك المنزلقات/الأسهم — فك القفل مؤقتاً */
  cameraAdjustTick?: number;
  onPoseCapture?: (pose: GfxCameraPose) => void;
  onPoseSaved?: () => void;
};

type SceneBundle = {
  renderer: any;
  scene: any;
  camera: any;
  pivot: any;
  ambient: any;
  key: any;
  fill: any;
  controls: any | null;
  animId: number;
  resize: () => void;
  userInteracting: boolean;
  resetting: boolean;
  resetT: number;
  resetFrom: { camPos: any; target: any };
  resetTo: { camPos: any; target: any };
  idleTimer: number | null;
  disposeControls: () => void;
  mixer: any | null;
  modelRoot: any | null;
};

const IDLE_RESET_MS = 2800;
const RESET_SPEED = 2.2;

function hexColor(hex: string, fallback: number): number {
  const h = (hex || '').trim();
  if (!/^#[0-9a-f]{3,8}$/i.test(h)) return fallback;
  return parseInt(h.replace('#', ''), 16);
}

function fitObjectToPivot(THREE: any, obj: any, pivot: any, cameraDistance: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 1.8 / maxDim;
  obj.position.sub(center);
  obj.scale.setScalar(scale);
  pivot.add(obj);
  return maxDim * scale * cameraDistance;
}

function setupModelAnimations(THREE: any, root: any, clips: any[], play: boolean, speed: number) {
  if (!clips?.length || play === false) return null;
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clips[0]);
  action.setEffectiveTimeScale(Math.max(0.1, speed || 1));
  action.play();
  return mixer;
}

function applyMaterialSettings(THREE: any, root: any, settings: ReturnType<typeof mergeGfxModel3dSettings>, forceColor = false) {
  const color = hexColor(settings.modelColor, 0x7fd44a);
  const tintAll = forceColor || settings.preserveModelColors === false;
  root.traverse((child: any) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat: any) => {
      if (!mat) return;
      if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        mat.metalness = settings.metalness;
        mat.roughness = settings.roughness;
        if (settings.enableReflections) mat.envMapIntensity = 1;
      }
      if (mat.isMeshPhongMaterial || mat.isMeshLambertMaterial) {
        mat.shininess = settings.enableReflections ? 80 : 20;
      }
      if (tintAll && settings.modelColor && mat.color) mat.color.setHex(color);
    });
  });
}

export function GfxModelViewer({
  url,
  settings,
  height = 320,
  className,
  style,
  interactive = false,
  allowUserControl = false,
  capturePose = false,
  savePoseTick = 0,
  poseLockTick = 0,
  cameraAdjustTick = 0,
  onPoseCapture,
  onPoseSaved,
}: GfxModelViewerProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const bundleRef = useRef<SceneBundle | null>(null);
  const onPoseCaptureRef = useRef(onPoseCapture);
  const onPoseSavedRef = useRef(onPoseSaved);
  onPoseCaptureRef.current = onPoseCapture;
  onPoseSavedRef.current = onPoseSaved;
  const skipSyncUntilRef = useRef(0);
  const pendingPoseSaveRef = useRef(false);
  const poseLockedRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [visible, setVisible] = useState(false);
  const cfg = mergeGfxModel3dSettings(settings);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const useControls = allowUserControl || capturePose;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some(e => e.isIntersecting)),
      { threshold: 0.08, rootMargin: '80px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !url.trim()) return;
    let cancelled = false;
    const host = canvasHostRef.current;
    if (!host) return;

    const disposeBundle = () => {
      const b = bundleRef.current;
      if (!b) return;
      cancelAnimationFrame(b.animId);
      window.removeEventListener('resize', b.resize);
      if (b.idleTimer) clearTimeout(b.idleTimer);
      b.disposeControls();
      b.renderer.dispose();
      b.scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => m?.dispose?.());
        }
      });
      host.innerHTML = '';
      bundleRef.current = null;
    };

    setStatus('loading');

    const loaders = useControls
      ? Promise.all([ensureThreeModelLoaders(), ensureOrbitControls()])
      : ensureThreeModelLoaders();

    loaders
      .then(() => {
        if (cancelled) return;
        const THREE = window.THREE;
        const w = host.clientWidth || 400;
        const h = typeof height === 'number' ? height : host.clientHeight || 320;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, interactive ? 2 : 1.5));
        renderer.setSize(w, h);
        renderer.outputEncoding = THREE.sRGBEncoding;
        const canvas = renderer.domElement;
        canvas.style.touchAction = useControls ? 'none' : 'auto';
        canvas.style.cursor = useControls ? 'grab' : 'default';
        canvas.style.pointerEvents = useControls ? 'auto' : 'none';
        host.appendChild(canvas);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(hexColor(cfg.backgroundColor, 0xe8eef4));

        const camera = new THREE.PerspectiveCamera(42, w / h, 0.05, 200);
        applyCameraPose(camera, cfg);

        const ambient = new THREE.AmbientLight(0xffffff, cfg.ambientIntensity);
        const key = new THREE.DirectionalLight(0xffffff, cfg.lightIntensity);
        key.position.set(4, 6, 5);
        const fill = new THREE.DirectionalLight(0xb8d4ff, cfg.lightIntensity * 0.45);
        fill.position.set(-5, 2, -3);
        const rim = new THREE.DirectionalLight(0xffffff, cfg.enableReflections ? cfg.lightIntensity * 0.35 : 0);
        rim.position.set(0, -2, -6);
        scene.add(ambient, key, fill, rim);

        const pivot = new THREE.Group();
        scene.add(pivot);

        let controls: any = null;
        let disposeControls = () => {};

        if (useControls && THREE.OrbitControls) {
          controls = new THREE.OrbitControls(camera, canvas);
          controls.enableDamping = true;
          controls.dampingFactor = 0.08;
          controls.enablePan = true;
          controls.enableZoom = true;
          controls.enableRotate = true;
          controls.rotateSpeed = 0.85;
          controls.zoomSpeed = 1.1;
          controls.panSpeed = 0.75;
          controls.minDistance = ORBIT_DIST_MIN;
          controls.maxDistance = ORBIT_DIST_MAX;
          controls.minPolarAngle = 0.08;
          controls.maxPolarAngle = Math.PI - 0.08;
          controls.screenSpacePanning = true;
          controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
          syncControlsFromSettings(controls, camera, cfg);

          const startIdleReset = () => {
            const b = bundleRef.current;
            if (!b || !allowUserControl || capturePose) return;
            if (b.idleTimer) clearTimeout(b.idleTimer);
            b.idleTimer = window.setTimeout(() => {
              const c = cfgRef.current;
              const from = { camPos: camera.position.clone(), target: controls.target.clone() };
              const toRaw = cameraPoseVectors(c);
              const to = {
                camPos: new THREE.Vector3(toRaw.camPos.x, toRaw.camPos.y, toRaw.camPos.z),
                target: new THREE.Vector3(toRaw.target.x, toRaw.target.y, toRaw.target.z),
              };
              b.resetFrom = from;
              b.resetTo = to;
              b.resetT = 0;
              b.resetting = true;
            }, IDLE_RESET_MS);
          };

          const onStart = () => {
            const b = bundleRef.current;
            if (!b) return;
            if (capturePose) poseLockedRef.current = false;
            b.userInteracting = true;
            b.resetting = false;
            if (b.idleTimer) clearTimeout(b.idleTimer);
            canvas.style.cursor = 'grabbing';
          };

          const onEnd = () => {
            const b = bundleRef.current;
            if (!b) return;
            canvas.style.cursor = 'grab';
            if (allowUserControl && !capturePose) {
              startIdleReset();
            } else {
              b.userInteracting = false;
            }
          };

          controls.addEventListener('start', onStart);
          controls.addEventListener('end', onEnd);

          disposeControls = () => {
            controls.removeEventListener('start', onStart);
            controls.removeEventListener('end', onEnd);
            controls.dispose();
          };
        }

        const modelSrc = resolveModelPlaybackSrc(url);
        const fmtHint = cfg.modelFormat === 'auto' ? 'auto' as const
          : cfg.modelFormat === 'fbx' ? 'fbx' as const
          : cfg.modelFormat === 'stl' ? 'stl' as const
          : cfg.modelFormat === 'gltf' ? 'gltf' as const
          : 'glb' as const;

        const loadBuffer = async (): Promise<ArrayBuffer> => {
          const res = await fetch(modelSrc);
          if (!res.ok) {
            const hint = await res.text().catch(() => '');
            throw new Error(`proxy ${res.status}${hint ? `: ${hint.slice(0, 80)}` : ''}`);
          }
          const buf = await res.arrayBuffer();
          if (buf.byteLength < 32) throw new Error('empty file');
          const head = new Uint8Array(buf.slice(0, 4));
          const isJson = head[0] === 0x7b;
          if (isJson) {
            const txt = new TextDecoder().decode(buf);
            if (txt.includes('"error"')) throw new Error(txt);
          }
          return buf;
        };

        const onLoaded = (root: any, clips: any[] = [], isStl = false) => {
          if (cancelled) return;
          fitObjectToPivot(THREE, root, pivot, cfg.cameraDistance);
          applyMaterialSettings(THREE, root, cfg, isStl);
          const playAnim = cfg.playModelAnimation !== false;
          const animSpeed = cfg.animationSpeed ?? 1;
          const mixer = setupModelAnimations(THREE, root, clips, playAnim, animSpeed);
          const b = bundleRef.current;
          if (b) {
            b.mixer = mixer;
            b.modelRoot = root;
            if (b.controls) {
              syncControlsFromSettings(b.controls, camera, cfgRef.current);
              if (capturePose && hasSavedOrbitPose(cfgRef.current)) {
                poseLockedRef.current = true;
              }
            } else {
              applyCameraPose(camera, cfgRef.current);
            }
          }
          setStatus('ready');
        };

        const onError = (err?: unknown) => {
          if (!cancelled) {
            console.warn('[GfxModelViewer] load failed:', modelSrc, err);
            setStatus('error');
          }
        };

        loadBuffer()
          .then((buf) => {
            if (cancelled) return;
            const fmt = detectModelFormatFromBuffer(buf, detectModelFormat(url, fmtHint));
            if (fmt === 'stl') {
              const geometry = new THREE.STLLoader().parse(buf);
              const material = new THREE.MeshStandardMaterial({
                color: hexColor(cfg.modelColor, 0x7fd44a),
                metalness: cfg.metalness,
                roughness: cfg.roughness,
              });
              onLoaded(new THREE.Mesh(geometry, material), [], true);
              return;
            }
            if (fmt === 'fbx') {
              if (!THREE.FBXLoader) throw new Error('FBXLoader missing');
              const object = new THREE.FBXLoader().parse(buf, '');
              onLoaded(object, object.animations || []);
              return;
            }
            const loader = new THREE.GLTFLoader();
            loader.parse(
              buf,
              '',
              (gltf: any) => onLoaded(gltf.scene, gltf.animations || []),
              (e: any) => onError(e),
            );
          })
          .catch(onError);

        let last = performance.now();
        const animate = (now: number) => {
          const b = bundleRef.current;
          if (!b) return;
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;

          if (b.resetting && b.controls) {
            b.resetT = Math.min(1, b.resetT + dt * RESET_SPEED);
            const ease = 1 - Math.pow(1 - b.resetT, 3);
            camera.position.lerpVectors(b.resetFrom.camPos, b.resetTo.camPos, ease);
            b.controls.target.lerpVectors(b.resetFrom.target, b.resetTo.target, ease);
            b.controls.update();
            if (b.resetT >= 1) {
              b.resetting = false;
              b.userInteracting = false;
              syncControlsFromSettings(b.controls, camera, cfgRef.current);
            }
          } else if (b.controls) {
            b.controls.update();
          }

          const canAutoRotate = cfgRef.current.autoRotate && visible && !b.userInteracting && !b.resetting && !b.mixer;
          if (canAutoRotate) {
            pivot.rotation.y += cfgRef.current.rotationDirection * cfgRef.current.rotationSpeed * 0.008 * dt;
          }

          if (b.mixer) {
            const spd = cfgRef.current.animationSpeed ?? 1;
            b.mixer.timeScale = Math.max(0.1, spd);
            b.mixer.update(dt);
          }

          renderer.render(scene, camera);
          b.animId = requestAnimationFrame(animate);
        };

        const resize = () => {
          const nw = host.clientWidth || w;
          const nh = typeof height === 'number' ? height : host.clientHeight || h;
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        };
        window.addEventListener('resize', resize);

        bundleRef.current = {
          renderer,
          scene,
          camera,
          pivot,
          ambient,
          key,
          fill,
          controls,
          animId: requestAnimationFrame(animate),
          resize,
          userInteracting: false,
          resetting: false,
          resetT: 0,
          resetFrom: { camPos: camera.position.clone(), target: controls?.target?.clone?.() },
          resetTo: { camPos: camera.position.clone(), target: controls?.target?.clone?.() },
          idleTimer: null,
          disposeControls,
          mixer: null,
          modelRoot: null,
        };
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      disposeBundle();
    };
  }, [url, visible, cfg.backgroundColor, cfg.ambientIntensity, cfg.lightIntensity, cfg.metalness, cfg.roughness, cfg.modelColor, cfg.preserveModelColors, cfg.enableReflections, cfg.modelFormat, height, interactive, useControls, allowUserControl, capturePose]);

  useEffect(() => {
    const b = bundleRef.current;
    if (!b?.modelRoot || status !== 'ready') return;
    const THREE = window.THREE;
    if (!THREE) return;
    applyMaterialSettings(THREE, b.modelRoot, cfg);
  }, [cfg.metalness, cfg.roughness, cfg.modelColor, cfg.preserveModelColors, cfg.enableReflections, status]);

  useEffect(() => {
    if (!savePoseTick) return;
    pendingPoseSaveRef.current = true;
  }, [savePoseTick]);

  useEffect(() => {
    if (poseLockTick) poseLockedRef.current = true;
  }, [poseLockTick]);

  useEffect(() => {
    if (cameraAdjustTick) poseLockedRef.current = false;
  }, [cameraAdjustTick]);

  useEffect(() => {
    if (!pendingPoseSaveRef.current) return;
    const b = bundleRef.current;
    if (!b?.controls || !b.camera || status !== 'ready') return;
    pendingPoseSaveRef.current = false;
    if (onPoseCaptureRef.current) {
      const pose = capturePoseFromControls(b.camera, b.controls);
      poseLockedRef.current = true;
      skipSyncUntilRef.current = Date.now() + 86400000;
      onPoseCaptureRef.current(pose);
      onPoseSavedRef.current?.();
    }
  }, [savePoseTick, status]);

  useEffect(() => {
    const b = bundleRef.current;
    if (!b?.camera || status !== 'ready') return;
    if (capturePose && poseLockedRef.current) return;
    if (Date.now() < skipSyncUntilRef.current) return;
    if (b.userInteracting || b.resetting) return;
    if (b.controls) {
      syncControlsFromSettings(b.controls, b.camera, cfg);
    } else {
      applyCameraPose(b.camera, cfg);
    }
  }, [cfg.viewPanX, cfg.viewPanY, cfg.cameraDistance, cfg.orbitAzimuth, cfg.orbitPolar, cfg.orbitDistance, status, capturePose]);

  useEffect(() => {
    const b = bundleRef.current;
    if (!b || status !== 'ready') return;
    const THREE = window.THREE;
    if (THREE && b.scene) b.scene.background = new THREE.Color(hexColor(cfg.backgroundColor, 0xe8eef4));
    if (b.ambient) b.ambient.intensity = cfg.ambientIntensity;
    if (b.key) b.key.intensity = cfg.lightIntensity;
    if (b.fill) b.fill.intensity = cfg.lightIntensity * 0.45;
  }, [cfg.backgroundColor, cfg.ambientIntensity, cfg.lightIntensity, status]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        width: '100%',
        height,
        position: 'relative',
        background: cfg.backgroundColor,
        borderRadius: 12,
        overflow: 'hidden',
        pointerEvents: useControls ? undefined : 'none',
        ...style,
      }}
    >
      <div ref={canvasHostRef} style={{ width: '100%', height: '100%', pointerEvents: useControls ? 'auto' : 'none' }} />
      {useControls && status === 'ready' && (
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          fontSize: 9, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.45)',
          padding: '3px 8px', borderRadius: 6, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {capturePose
            ? 'اسحب للتدوير · قرص للتقريب · زر «حفظ المنظور»'
            : 'اسحب للتدوير · قرص للتقريب · إصبعان للتحريك'}
        </div>
      )}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12, fontWeight: 600, gap: 8, flexDirection: 'column', padding: 12, textAlign: 'center' }}>
          <span><i className="fa-solid fa-spinner fa-spin" /> جاري تحميل المجسم…</span>
          <span style={{ fontSize: 10, opacity: 0.85 }}>الملفات الكبيرة (&gt;10MB) قد تستغرق 30–60 ثانية</span>
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', color: '#ffb4b4', fontSize: 11, padding: 12, textAlign: 'center', gap: 6 }}>
          <span>تعذّر تحميل المجسم</span>
          <span style={{ color: '#ddd', fontSize: 10, lineHeight: 1.5 }}>
            1) الصق رابط <b>/view</b> من Google Drive في حقل الملف أعلاه<br />
            2) المشاركة: أي شخص لديه الرابط<br />
            3) ارفع <code style={{ fontSize: 9 }}>api/video-proxy.php</code> للسيرفر<br />
            4) اختر صيغة GLB / FBX / STL إن لم يظهر تلقائياً
          </span>
        </div>
      )}
    </div>
  );
}
