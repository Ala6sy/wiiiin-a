import { useEffect, useRef, useCallback, useState } from 'react';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
  minHeight?: number;
}

export function RichEditor({ value, onChange, placeholder = '', dir = 'rtl', minHeight = 220 }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const lastValue = useRef(value);
  const [customFontSize, setCustomFontSize] = useState('14');

  const FONT_PRESETS = [5, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72, 96];

  /* sync external value → editor (only when changed externally, not by typing) */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastValue.current) {
      lastValue.current = value;
      if (el.innerHTML !== value) {
        isInternalChange.current = true;
        el.innerHTML = value;
        isInternalChange.current = false;
      }
    }
  }, [value]);

  /* initialise on mount */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = value || '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = useCallback(() => {
    if (isInternalChange.current) return;
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastValue.current = html;
    onChange(html);
  }, [onChange]);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const insertLink = () => {
    const url = prompt('أدخل الرابط / Enter URL:', 'https://');
    if (url) exec('createLink', url);
  };

  const insertVideo = () => {
    const raw = prompt('أدخل رابط يوتيوب أو فيميو / YouTube or Vimeo URL:', 'https://www.youtube.com/watch?v=');
    if (!raw) return;
    let embedSrc = '';
    const ytMatch = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    const vimeoMatch = raw.match(/vimeo\.com\/(\d+)/);
    if (ytMatch) embedSrc = `https://www.youtube.com/embed/${ytMatch[1]}`;
    else if (vimeoMatch) embedSrc = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    else embedSrc = raw;

    const html = `<div class="rte-video-wrap" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:12px 0;border-radius:10px;">
<iframe src="${embedSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>
</div><p><br></p>`;
    exec('insertHTML', html);
  };

  const insertColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    exec('foreColor', e.target.value);
  };

  const applyFontSize = (px: number) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const size = Math.min(120, Math.max(5, px));
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      document.execCommand('fontSize', false, '7');
      handleInput();
      return;
    }
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = `${size}px`;
      span.appendChild(document.createTextNode('\u200B'));
      range.insertNode(span);
      range.setStart(span.firstChild!, 1);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      const span = document.createElement('span');
      span.style.fontSize = `${size}px`;
      try {
        range.surroundContents(span);
      } catch {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
    }
    handleInput();
  };

  const toolBtn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: 6,
    padding: '4px 9px',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 700,
    lineHeight: 1.4,
    transition: 'background 0.15s',
  };

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden', background: 'rgba(0,20,60,0.8)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 5, flexWrap: 'wrap', padding: '8px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(0,15,50,0.6)',
        alignItems: 'center',
      }}>
        <button type="button" style={toolBtn} title="Bold" onMouseDown={e => { e.preventDefault(); exec('bold'); }}>
          <b>B</b>
        </button>
        <button type="button" style={{ ...toolBtn, fontStyle: 'italic' }} title="Italic" onMouseDown={e => { e.preventDefault(); exec('italic'); }}>
          <i>I</i>
        </button>
        <button type="button" style={{ ...toolBtn, textDecoration: 'underline' }} title="Underline" onMouseDown={e => { e.preventDefault(); exec('underline'); }}>
          <u>U</u>
        </button>

        <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', height: 22, margin: '0 3px' }} />

        {/* Color picker */}
        <label title="لون النص / Text Color" style={{ ...toolBtn, padding: '3px 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12 }}>A</span>
          <input type="color" defaultValue="#ffdd00" onChange={insertColorPicker}
            style={{ width: 18, height: 18, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
        </label>

        <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', height: 22, margin: '0 3px' }} />

        {/* Font size */}
        <select
          title="حجم الخط / Font Size"
          defaultValue=""
          onChange={e => { const v = Number(e.target.value); if (v) applyFontSize(v); e.target.value = ''; }}
          style={{ ...toolBtn, padding: '3px 6px', fontSize: 11, fontWeight: 600, minWidth: 52 }}
        >
          <option value="" disabled>px</option>
          {FONT_PRESETS.map(n => <option key={n} value={n}>{n}px</option>)}
        </select>
        <input
          type="number"
          min={5}
          max={120}
          value={customFontSize}
          title="حجم مخصص"
          onChange={e => setCustomFontSize(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyFontSize(Number(customFontSize)); } }}
          style={{ ...toolBtn, width: 48, padding: '3px 4px', fontSize: 11, textAlign: 'center' }}
        />
        <button type="button" style={{ ...toolBtn, fontSize: 10, padding: '3px 7px' }} title="تطبيق الحجم المخصص"
          onMouseDown={e => { e.preventDefault(); applyFontSize(Number(customFontSize)); }}>
          A
        </button>

        <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', height: 22, margin: '0 3px' }} />

        {/* Link */}
        <button type="button" style={toolBtn} title="إدراج رابط / Insert Link" onMouseDown={e => { e.preventDefault(); insertLink(); }}>
          <i className="fa-solid fa-link" />
        </button>

        {/* Video */}
        <button type="button" style={toolBtn} title="تضمين فيديو / Embed Video" onMouseDown={e => { e.preventDefault(); insertVideo(); }}>
          <i className="fa-brands fa-youtube" />
        </button>

        <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', height: 22, margin: '0 3px' }} />

        {/* Lists */}
        <button type="button" style={toolBtn} title="قائمة نقطية / Bullet List" onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}>
          <i className="fa-solid fa-list-ul" />
        </button>
        <button type="button" style={toolBtn} title="قائمة مرقمة / Numbered List" onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }}>
          <i className="fa-solid fa-list-ol" />
        </button>

        <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', height: 22, margin: '0 3px' }} />

        {/* Clear formatting */}
        <button type="button" style={{ ...toolBtn, fontSize: 11 }} title="مسح التنسيق / Clear Formatting" onMouseDown={e => { e.preventDefault(); exec('removeFormat'); }}>
          <i className="fa-solid fa-text-slash" />
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        dir={dir}
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight,
          padding: '14px 16px',
          color: '#ffffff',
          fontSize: 13.5,
          lineHeight: 1.9,
          outline: 'none',
          fontFamily: 'Tajawal, sans-serif',
          overflowY: 'auto',
          wordBreak: 'break-word',
        }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: rgba(180,200,230,0.4);
          pointer-events: none;
        }
        [contenteditable] a { color: #7eb8ff; text-decoration: underline; }
        [contenteditable] ul, [contenteditable] ol { padding-inline-start: 22px; }
        [contenteditable] li { margin-bottom: 4px; }
      `}</style>
    </div>
  );
}

/** Strip HTML tags to get plain text (for card previews) */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
