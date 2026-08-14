import type { GfxDevicePose, GfxModel3dSettings } from './gfxModel3d';
import {
  DEFAULT_GFX_MODEL_3D,
  CAM_PAN_MIN, CAM_PAN_MAX, CAM_DIST_MIN, CAM_DIST_MAX,
  CAM_PAN_STEP, CAM_DIST_STEP,
  CAM_ARROW_STEP, CAM_ARROW_STEP_FINE, CAM_ARROW_STEP_LARGE, CAM_ZOOM_STEP,
  hasSavedOrbitPose,
  hasDeviceOrbitPose,
  gfxViewSettingsKey,
  applyDevicePoseToSettings,
  settingsForDevicePreview,
  extractDesktopPose,
} from './gfxModel3d';
import { GfxModelViewer } from './GfxModelViewer';
import { useState, useEffect } from 'react';

type EditDevice = 'mobile' | 'desktop';
type DeviceCounter = Record<EditDevice, number>;

const MOBILE_PREVIEW_H = 360;
const DESKTOP_PREVIEW_H = 130;

function SliderRow({ label, value, min, max, step, onChange, suffix = '' }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#223344', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{typeof value === 'number' ? value.toFixed(3) : value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }} />
    </div>
  );
}

function CamBtn({ title, onClick, children, wide }: { title: string; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button type="button" className="btn-outline-sm" title={title} onClick={onClick}
      style={{ width: wide ? 'auto' : 32, minWidth: wide ? 56 : 32, height: 28, padding: wide ? '0 8px' : 0, fontSize: 11, color: '#003366', borderColor: 'rgba(0,51,102,0.4)', background: 'rgba(0,51,102,0.06)', fontWeight: 800 }}>
      {children}
    </button>
  );
}

function CameraPanControls({
  panX, panY, distance, onPanChange, onDistanceChange, onReset,
}: {
  panX: number; panY: number; distance: number;
  onPanChange: (x: number, y: number) => void;
  onDistanceChange: (d: number) => void;
  onReset: () => void;
}) {
  const clampPan = (x: number, y: number) => onPanChange(
    Math.min(CAM_PAN_MAX, Math.max(CAM_PAN_MIN, +x.toFixed(5))),
    Math.min(CAM_PAN_MAX, Math.max(CAM_PAN_MIN, +y.toFixed(5))),
  );
  const move = (dx: number, dy: number) => clampPan(panX + dx, panY + dy);

  const presets: { label: string; x: number; y: number; d: number }[] = [
    { label: 'أمامي', x: 0, y: 0, d: 1 },
    { label: 'علوي', x: 0, y: 0.85, d: 1.15 },
    { label: 'جانبي', x: 0.9, y: 0.15, d: 1.1 },
    { label: 'قريب', x: panX, y: panY, d: CAM_DIST_MIN + 0.05 },
    { label: 'بعيد', x: panX, y: panY, d: CAM_DIST_MAX },
  ];

  return (
    <div style={{ marginBottom: 8, padding: '8px 10px', background: '#fff', borderRadius: 8, border: '1px solid #c8dff5' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#003366', marginBottom: 6 }}>
        <i className="fa-solid fa-camera" /> توجيه الكاميرا
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '32px 32px 32px', gap: 3, justifyContent: 'center', marginBottom: 6 }}>
        <span />
        <CamBtn title="أعلى (خطوة كبيرة)" onClick={() => move(0, CAM_ARROW_STEP_LARGE)}><i className="fa-solid fa-chevron-up" /></CamBtn>
        <span />
        <CamBtn title="يسار" onClick={() => move(-CAM_ARROW_STEP, 0)}><i className="fa-solid fa-chevron-left" /></CamBtn>
        <CamBtn title="توسيط" onClick={onReset}><i className="fa-solid fa-crosshairs" /></CamBtn>
        <CamBtn title="يمين" onClick={() => move(CAM_ARROW_STEP, 0)}><i className="fa-solid fa-chevron-right" /></CamBtn>
        <span />
        <CamBtn title="أسفل (خطوة كبيرة)" onClick={() => move(0, -CAM_ARROW_STEP_LARGE)}><i className="fa-solid fa-chevron-down" /></CamBtn>
        <span />
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
        <CamBtn title="أعلى قليلاً" wide onClick={() => move(0, CAM_ARROW_STEP_FINE)}>↑ دقيق</CamBtn>
        <CamBtn title="أسفل قليلاً" wide onClick={() => move(0, -CAM_ARROW_STEP_FINE)}>↓ دقيق</CamBtn>
        <CamBtn title="تقريب" wide onClick={() => onDistanceChange(Math.max(CAM_DIST_MIN, +(distance - CAM_ZOOM_STEP).toFixed(5)))}>
          <i className="fa-solid fa-magnifying-glass-plus" />
        </CamBtn>
        <CamBtn title="إبعاد" wide onClick={() => onDistanceChange(Math.min(CAM_DIST_MAX, +(distance + CAM_ZOOM_STEP).toFixed(5)))}>
          <i className="fa-solid fa-magnifying-glass-minus" />
        </CamBtn>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {presets.map(p => (
          <button key={p.label} type="button" className="btn-outline-sm"
            onClick={() => { onPanChange(p.x, p.y); onDistanceChange(p.d); }}
            style={{ fontSize: 9, padding: '3px 8px', color: '#003366' }}>
            {p.label}
          </button>
        ))}
      </div>

      <SliderRow label="تحريك أفقي" value={panX} min={CAM_PAN_MIN} max={CAM_PAN_MAX} step={CAM_PAN_STEP} onChange={x => onPanChange(x, panY)} />
      <SliderRow label="تحريك عمودي" value={panY} min={CAM_PAN_MIN} max={CAM_PAN_MAX} step={CAM_PAN_STEP} onChange={y => onPanChange(panX, y)} />

      <div style={{ fontSize: 9.5, color: '#556677', textAlign: 'center', marginTop: 4 }}>
        أفقي {panX.toFixed(3)} — عمودي {panY.toFixed(3)} — بعد {distance.toFixed(3)}
        <br />
        <span style={{ fontSize: 9 }}>الأسهم تكمّل السحب بالماوس — احفظ المنظور من الزر أعلاه</span>
      </div>
    </div>
  );
}

export function GfxModel3dAdmin({
  url,
  settings,
  onChange,
  onPosePersist,
}: {
  url: string;
  settings: GfxModel3dSettings;
  onChange: (s: GfxModel3dSettings) => void;
  /** حفظ المنظور فوراً في المشروع (لا يُفقد عند الخروج) */
  onPosePersist?: (s: GfxModel3dSettings) => void;
}) {
  const s = { ...DEFAULT_GFX_MODEL_3D, ...settings };
  const [editDevice, setEditDevice] = useState<EditDevice>('mobile');
  const [savePoseTick, setSavePoseTick] = useState<DeviceCounter>({ mobile: 0, desktop: 0 });
  const [poseLockTick, setPoseLockTick] = useState<DeviceCounter>({ mobile: 0, desktop: 0 });
  const [cameraAdjustTick, setCameraAdjustTick] = useState<DeviceCounter>({ mobile: 0, desktop: 0 });
  const [poseSaved, setPoseSaved] = useState<EditDevice | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [mobileDraftPose, setMobileDraftPose] = useState<GfxDevicePose>(() => settings.mobilePose || extractDesktopPose(settings));
  const [desktopDraftPose, setDesktopDraftPose] = useState<GfxDevicePose>(() => extractDesktopPose(settings));

  const patch = (p: Partial<GfxModel3dSettings>) => onChange({ ...settings, ...p });
  const savedViewKey = gfxViewSettingsKey(settings);

  useEffect(() => {
    setMobileDraftPose(settings.mobilePose || extractDesktopPose(settings));
    setDesktopDraftPose(extractDesktopPose(settings));
  }, [savedViewKey]);

  const activePose: GfxDevicePose = editDevice === 'mobile' ? mobileDraftPose : desktopDraftPose;

  const patchActiveCamera = (p: Partial<GfxDevicePose>) => {
    setCameraAdjustTick((t) => ({ ...t, [editDevice]: t[editDevice] + 1 }));
    if (editDevice === 'mobile') {
      setMobileDraftPose((cur) => ({ ...(cur || extractDesktopPose(settings)), ...p }));
      return;
    }
    setDesktopDraftPose((cur) => ({ ...(cur || extractDesktopPose(settings)), ...p }));
  };

  const resetCamera = () => patchActiveCamera({
    viewPanX: 0,
    viewPanY: 0,
    viewPanZ: 0,
    cameraDistance: 1,
    orbitAzimuth: undefined,
    orbitPolar: undefined,
    orbitDistance: undefined,
    referenceAspect: undefined,
  });

  const savedMobilePreviewSettings = settingsForDevicePreview(settings, 'mobile');
  const savedDesktopPreviewSettings = settingsForDevicePreview(settings, 'desktop');
  const mobilePreviewSettings = editDevice === 'mobile'
    ? settingsForDevicePreview(applyDevicePoseToSettings(settings, mobileDraftPose, 'mobile'), 'mobile')
    : savedMobilePreviewSettings;
  const desktopPreviewSettings = editDevice === 'desktop'
    ? settingsForDevicePreview(applyDevicePoseToSettings(settings, desktopDraftPose, 'desktop'), 'desktop')
    : savedDesktopPreviewSettings;

  useEffect(() => {
    if (hasSavedOrbitPose(settings) || hasDeviceOrbitPose(settings.mobilePose)) {
      setPoseLockTick((t) => ({ mobile: t.mobile + 1, desktop: t.desktop + 1 }));
    }
  }, [savedViewKey]);

  const persistPose = (pose: GfxDevicePose, device: EditDevice) => {
    if (device === 'mobile') setMobileDraftPose(pose);
    else setDesktopDraftPose(pose);
    const next = applyDevicePoseToSettings(settings, pose, device);
    onChange(next);
    onPosePersist?.(next);
  };

  return (
    <div style={{ marginBottom: 10, background: '#f0f7ff', borderRadius: 10, padding: '10px 12px', border: '1px solid #c8dff5' }}>
      <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 8 }}>
        <i className="fa-solid fa-cube" /> مجسم ثلاثي الأبعاد GLB / FBX / STL
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 10, cursor: 'pointer', fontWeight: 700, color: s.useAsMain ? '#003366' : '#556677' }}>
        <input type="checkbox" checked={!!s.useAsMain} onChange={e => patch({ useAsMain: e.target.checked })} />
        ★ عرض المجسم كصورة رئيسية في المعرض وصفحة المشروع
      </label>

      {/* معاينة ثابتة يسار — إعدادات يمين */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'flex-start', direction: 'ltr' }}>
        {url.trim() && (
          <div style={{
            flex: '0 0 44%',
            maxWidth: 320,
            minWidth: 210,
            position: 'sticky',
            top: 8,
            alignSelf: 'flex-start',
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, direction: 'rtl' }}>
              <button type="button" className="btn-outline-sm"
                onClick={() => setEditDevice('mobile')}
                style={{
                  fontSize: 10, flex: 1, fontWeight: 800,
                  background: editDevice === 'mobile' ? '#003366' : '#fff',
                  color: editDevice === 'mobile' ? '#fff' : '#003366',
                  borderColor: '#003366',
                }}>
                <i className="fa-solid fa-mobile-screen" /> جوال
              </button>
              <button type="button" className="btn-outline-sm"
                onClick={() => setEditDevice('desktop')}
                style={{
                  fontSize: 10, flex: 1, fontWeight: 800,
                  background: editDevice === 'desktop' ? '#003366' : '#fff',
                  color: editDevice === 'desktop' ? '#fff' : '#003366',
                  borderColor: '#003366',
                }}>
                <i className="fa-solid fa-desktop" /> كمبيوتر
              </button>
            </div>

            <button type="button" className="btn-outline-sm"
              onClick={() => setShowGuide(v => !v)}
              title="خطوط توجيه متقاطعة في منتصف المعاينة — لوحة التحكم فقط، لا تظهر للزوار"
              style={{
                fontSize: 10, width: '100%', marginBottom: 8, fontWeight: 700, direction: 'rtl',
                background: showGuide ? 'rgba(255,0,80,0.08)' : '#fff',
                color: showGuide ? '#c81e5b' : '#556677',
                borderColor: showGuide ? 'rgba(255,0,80,0.4)' : '#c8dff5',
              }}>
              <i className={`fa-solid ${showGuide ? 'fa-plus' : 'fa-plus-minus'}`} />
              {showGuide ? ' إخفاء خطوط التوسيط' : ' إظهار خطوط التوسيط'}
            </button>

            {/* معاينة الجوال — كبيرة */}
            <div style={{
              border: editDevice === 'mobile' ? '2px solid #003366' : '1px solid #c8dff5',
              borderRadius: 14,
              padding: 8,
              background: '#0b1220',
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ec0ff', marginBottom: 6, direction: 'rtl', textAlign: 'right' }}>
                <i className="fa-solid fa-mobile-screen" /> معاينة الجوال
                {hasDeviceOrbitPose(settings.mobilePose) && (
                  <span style={{ color: '#4ade80', marginInlineStart: 6 }}>✓ مثبت</span>
                )}
              </div>
              <div style={{
                maxWidth: 260,
                margin: '0 auto',
                borderRadius: 18,
                overflow: 'hidden',
                border: '3px solid #334',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                background: '#111',
              }}>
                <GfxModelViewer
                  key={`m-${gfxViewSettingsKey(mobilePreviewSettings)}`}
                  url={url}
                  settings={mobilePreviewSettings}
                  height={MOBILE_PREVIEW_H}
                  interactive={editDevice === 'mobile'}
                  allowUserControl={editDevice === 'mobile'}
                  capturePose={editDevice === 'mobile'}
                  savePoseTick={savePoseTick.mobile}
                  poseLockTick={poseLockTick.mobile}
                  cameraAdjustTick={cameraAdjustTick.mobile}
                  centerGuide={showGuide}
                  onPoseCapture={pose => {
                    persistPose(pose, 'mobile');
                  }}
                  onPoseSaved={() => {
                    setPoseLockTick((t) => ({ ...t, mobile: t.mobile + 1 }));
                    setPoseSaved('mobile');
                    window.setTimeout(() => setPoseSaved(null), 3200);
                  }}
                />
              </div>
            </div>

            {/* معاينة الكمبيوتر — صغيرة تحت الجوال */}
            <div style={{
              border: editDevice === 'desktop' ? '2px solid #003366' : '1px solid #c8dff5',
              borderRadius: 10,
              padding: 8,
              background: '#eef3f9',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#003366', marginBottom: 6, direction: 'rtl', textAlign: 'right' }}>
                <i className="fa-solid fa-desktop" /> معاينة الكمبيوتر (شاشة صغيرة)
                {hasSavedOrbitPose(settings) && (
                  <span style={{ color: '#2a7a2a', marginInlineStart: 6 }}>✓ مثبت</span>
                )}
              </div>
              <div style={{
                maxWidth: 220,
                margin: '0 auto',
                borderRadius: 8,
                overflow: 'hidden',
                border: '2px solid #99a',
                background: '#ddd',
                boxShadow: '0 4px 14px rgba(0,51,102,0.15)',
              }}>
                <GfxModelViewer
                  key={`d-${gfxViewSettingsKey(desktopPreviewSettings)}`}
                  url={url}
                  settings={desktopPreviewSettings}
                  height={DESKTOP_PREVIEW_H}
                  interactive={editDevice === 'desktop'}
                  allowUserControl={editDevice === 'desktop'}
                  capturePose={editDevice === 'desktop'}
                  savePoseTick={savePoseTick.desktop}
                  poseLockTick={poseLockTick.desktop}
                  cameraAdjustTick={cameraAdjustTick.desktop}
                  centerGuide={showGuide}
                  onPoseCapture={pose => {
                    persistPose(pose, 'desktop');
                  }}
                  onPoseSaved={() => {
                    setPoseLockTick((t) => ({ ...t, desktop: t.desktop + 1 }));
                    setPoseSaved('desktop');
                    window.setTimeout(() => setPoseSaved(null), 3200);
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 8, direction: 'rtl', flexWrap: 'wrap' }}>
              <button type="button" className="btn-prime btn-sm" style={{ fontSize: 10, padding: '5px 12px' }}
                onClick={() => setSavePoseTick((t) => ({ ...t, [editDevice]: t[editDevice] + 1 }))}>
                <i className="fa-solid fa-camera-retro" />
                {editDevice === 'mobile' ? ' حفظ منظور الجوال' : ' حفظ منظور الكمبيوتر'}
              </button>
              {poseSaved && (
                <span style={{ fontSize: 10, color: '#2a7a2a', fontWeight: 700, alignSelf: 'center' }}>
                  <i className="fa-solid fa-circle-check" />
                  {poseSaved === 'mobile' ? ' تم تثبيت منظور الجوال' : ' تم تثبيت منظور الكمبيوتر'}
                </span>
              )}
            </div>
            <p style={{ fontSize: 9, color: '#556677', margin: '6px 0 0', direction: 'rtl', textAlign: 'right', lineHeight: 1.55 }}>
              اختر <b>جوال</b> أو <b>كمبيوتر</b>، حرّك المجسم حتى يتوسّط الشاشة، ثم احفظ المنظور لهذا الجهاز.
              المنظوران منفصلان — ما تثبّته للجوال لا يغيّر الكمبيوتر والعكس.
            </p>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, direction: 'rtl', maxHeight: url.trim() ? 620 : undefined, overflowY: url.trim() ? 'auto' : undefined, paddingInlineStart: 2 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, marginBottom: 8, cursor: 'pointer', fontWeight: 600, color: s.preserveModelColors !== false ? '#2a7a2a' : '#556677' }}>
            <input type="checkbox" checked={s.preserveModelColors !== false} onChange={e => patch({ preserveModelColors: e.target.checked })} />
            الاحتفاظ بألوان الملف الأصلية (GLB / FBX)
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: '#223344' }}>صيغة الملف</label>
              <select value={s.modelFormat || 'auto'} onChange={e => patch({ modelFormat: e.target.value as GfxModel3dSettings['modelFormat'] })}
                style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11 }}>
                <option value="auto">تلقائي</option>
                <option value="glb">GLB</option>
                <option value="gltf">GLTF</option>
                <option value="stl">STL</option>
                <option value="fbx">FBX (متحرك)</option>
              </select>
            </div>
            <div style={{ opacity: s.preserveModelColors !== false && s.modelFormat !== 'stl' ? 0.45 : 1 }}>
              <label style={{ fontSize: 10, color: '#223344' }}>
                {s.modelFormat === 'stl' ? 'لون المجسم (STL)' : 'لون موحّد للمجسم'}
              </label>
              <input type="color" value={s.modelColor || '#7fd44a'} disabled={s.preserveModelColors !== false && s.modelFormat !== 'stl'}
                onChange={e => patch({ modelColor: e.target.value, preserveModelColors: false })}
                style={{ width: '100%', height: 30, borderRadius: 6, border: '1px solid #c8dff5', padding: 2 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={s.playModelAnimation !== false} onChange={e => patch({ playModelAnimation: e.target.checked })} />
              تشغيل حركة FBX / Keyframe
            </label>
            <div>
              <label style={{ fontSize: 10, color: '#223344' }}>سرعة الحركة</label>
              <input type="range" min={0.1} max={3} step={0.1} value={s.animationSpeed ?? 1}
                onChange={e => patch({ animationSpeed: parseFloat(e.target.value) })}
                style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={s.autoRotate !== false} onChange={e => patch({ autoRotate: e.target.checked })} />
              دوران تلقائي (عند عدم وجود حركة)
            </label>
            <div>
              <label style={{ fontSize: 10, color: '#223344' }}>اتجاه الدوران</label>
              <select value={String(s.rotationDirection ?? 1)} onChange={e => patch({ rotationDirection: parseInt(e.target.value, 10) as 1 | -1 })}
                style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11 }}>
                <option value="1">يمين ←</option>
                <option value="-1">يسار →</option>
              </select>
            </div>
          </div>

          <SliderRow label="سرعة الدوران" value={s.rotationSpeed ?? 35} min={0} max={100} step={1} onChange={v => patch({ rotationSpeed: v })} />
          <SliderRow
            label={`بعد الكاميرا (${editDevice === 'mobile' ? 'جوال' : 'كمبيوتر'})`}
            value={activePose.cameraDistance ?? 1}
            min={CAM_DIST_MIN}
            max={CAM_DIST_MAX}
            step={CAM_DIST_STEP}
            onChange={v => patchActiveCamera({ cameraDistance: v })}
          />

          <CameraPanControls
            panX={activePose.viewPanX ?? 0}
            panY={activePose.viewPanY ?? 0}
            distance={activePose.cameraDistance ?? 1}
            onPanChange={(x, y) => patchActiveCamera({ viewPanX: x, viewPanY: y })}
            onDistanceChange={d => patchActiveCamera({ cameraDistance: d })}
            onReset={resetCamera}
          />

          <SliderRow label="إضاءة عامة" value={s.ambientIntensity ?? 0.65} min={0} max={2} step={0.05} onChange={v => patch({ ambientIntensity: v })} />
          <SliderRow label="إضاءة رئيسية" value={s.lightIntensity ?? 1.2} min={0} max={3} step={0.05} onChange={v => patch({ lightIntensity: v })} />
          <SliderRow label="لمعان / انعكاس (Metalness)" value={s.metalness ?? 0.35} min={0} max={1} step={0.05} onChange={v => patch({ metalness: v })} />
          <SliderRow label="خشونة السطح (Roughness)" value={s.roughness ?? 0.42} min={0} max={1} step={0.05} onChange={v => patch({ roughness: v })} />

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: '#223344' }}>لون الخلفية</label>
            <input type="color" value={s.backgroundColor || '#e8eef4'} onChange={e => patch({ backgroundColor: e.target.value })}
              style={{ width: '100%', height: 30, borderRadius: 6, border: '1px solid #c8dff5', padding: 2 }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, marginBottom: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={s.enableReflections !== false} onChange={e => patch({ enableReflections: e.target.checked })} />
            تفعيل الانعكاسات والإضاءة المحيطية
          </label>
        </div>
      </div>
    </div>
  );
}
