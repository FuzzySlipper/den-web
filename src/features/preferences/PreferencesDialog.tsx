/**
 * PreferencesDialog — runtime UI for adjusting Den Web appearance and layout.
 *
 * Opened from a gear button in the channel header.  All changes persist to
 * localStorage and apply immediately via CSS custom properties.
 *
 * V1 scope: chat density, layout split, theme accent/background/text, font.
 * See types.ts for the deferred color surfaces TODO.
 */

import { useCallback, useState } from 'react';
import type { ChatPreferences, DenWebPreferences, FontPreferences, KeyboardPreferences, LayoutPreferences, ThemePreferences } from './types';

interface Props {
  prefs: DenWebPreferences;
  onUpdateSection: <K extends keyof DenWebPreferences>(key: K, value: DenWebPreferences[K]) => void;
  onReset: () => void;
  onClose: () => void;
}

export function PreferencesDialog({ prefs, onUpdateSection, onReset, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'chat' | 'layout' | 'theme' | 'font' | 'keyboard'>('chat');

  return (
    <div className="preferences-overlay" role="dialog" aria-label="Preferences" aria-modal="true">
      <div className="preferences-panel">
        <div className="preferences-header">
          <h2>Preferences</h2>
          <button type="button" className="detail-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="preferences-tabs">
          {(['chat', 'layout', 'theme', 'font', 'keyboard'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              className={`preferences-tab ${activeTab === tab ? 'preferences-tab-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'chat' ? 'Chat' : tab === 'layout' ? 'Layout' : tab === 'theme' ? 'Theme' : tab === 'font' ? 'Font' : 'Keyboard'}
            </button>
          ))}
        </div>

        <div className="preferences-body">
          {activeTab === 'chat' && (
            <ChatSection value={prefs.chat} onChange={v => onUpdateSection('chat', v)} />
          )}
          {activeTab === 'layout' && (
            <LayoutSection value={prefs.layout} onChange={v => onUpdateSection('layout', v)} />
          )}
          {activeTab === 'theme' && (
            <ThemeSection value={prefs.theme} onChange={v => onUpdateSection('theme', v)} />
          )}
          {activeTab === 'font' && (
            <FontSection value={prefs.font} onChange={v => onUpdateSection('font', v)} />
          )}
          {activeTab === 'keyboard' && (
            <KeyboardSection value={prefs.keyboard} onChange={v => onUpdateSection('keyboard', v)} />
          )}
        </div>

        <div className="preferences-footer">
          <button type="button" className="detail-action detail-action-primary" onClick={onReset}>
            Reset to defaults
          </button>
          <span className="preferences-persistence-note">
            Saved locally in browser. Changes apply immediately.
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab sections
// ---------------------------------------------------------------------------

function ChatSection({ value, onChange }: { value: ChatPreferences; onChange: (v: ChatPreferences) => void }) {
  const set = useCallback(
    <K extends keyof ChatPreferences>(key: K, val: ChatPreferences[K]) =>
      onChange({ ...value, [key]: val }),
    [value, onChange],
  );

  return (
    <div className="preferences-section">
      <h3>Chat transcript density</h3>
      <SliderRow label="Row gap (px)" min={0} max={16} step={1} value={value.rowGap} onChange={v => set('rowGap', v)} />
      <SliderRow label="Message padding (px)" min={0} max={16} step={1} value={value.messagePadding} onChange={v => set('messagePadding', v)} />
      <SliderRow label="Column gap (px)" min={2} max={24} step={1} value={value.columnGap} onChange={v => set('columnGap', v)} />
      <p className="preferences-note">Timestamp / name / message spacing in the chat transcript.</p>
    </div>
  );
}

function LayoutSection({ value, onChange }: { value: LayoutPreferences; onChange: (v: LayoutPreferences) => void }) {
  const set = useCallback(
    <K extends keyof LayoutPreferences>(key: K, val: LayoutPreferences[K]) =>
      onChange({ ...value, [key]: val }),
    [value, onChange],
  );

  return (
    <div className="preferences-section">
      <h3>Chat vs participants sizing</h3>
      <SliderRow label="Chat area fraction" min={0.55} max={0.95} step={0.05} value={value.chatFraction} onChange={v => set('chatFraction', Math.round(v * 100) / 100)} />
      <label className="preferences-toggle">
        <input
          type="checkbox"
          checked={value.showParticipants}
          onChange={e => set('showParticipants', e.target.checked)}
        />
        Show participants sidebar
      </label>
    </div>
  );
}

function ThemeSection({ value, onChange }: { value: ThemePreferences; onChange: (v: ThemePreferences) => void }) {
  const set = useCallback(
    <K extends keyof ThemePreferences>(key: K, val: ThemePreferences[K]) =>
      onChange({ ...value, [key]: val }),
    [value, onChange],
  );

  return (
    <div className="preferences-section">
      <h3>Color theme</h3>
      <ColorRow label="Accent" value={value.accent} onChange={v => set('accent', v)} />
      <ColorRow label="Background" value={value.background} onChange={v => set('background', v)} />
      <ColorRow label="Surface" value={value.surface} onChange={v => set('surface', v)} />
      <ColorRow label="Text" value={value.text} onChange={v => set('text', v)} />
      <ColorRow label="Muted text" value={value.textMuted} onChange={v => set('textMuted', v)} />
      <p className="preferences-note">
        TODO: border, bg-hover, bg-selected, status colors (green/yellow/red/orange/purple/cyan),
        and syntax highlighting palette are not yet customizable in this V1 slice.
      </p>
    </div>
  );
}

function FontSection({ value, onChange }: { value: FontPreferences; onChange: (v: FontPreferences) => void }) {
  const set = useCallback(
    <K extends keyof FontPreferences>(key: K, val: FontPreferences[K]) =>
      onChange({ ...value, [key]: val }),
    [value, onChange],
  );

  return (
    <div className="preferences-section">
      <h3>Font</h3>
      <p className="preferences-note">
        Font stacks are ordered fallback lists: the browser uses the first installed font, then falls back through the list.
        Monospace is used for code-like/dense data (chat transcript, ids, task rows); sans-serif is used for regular UI text.
      </p>
      <label className="preferences-field-row">
        <span>Monospace font stack</span>
        <input
          type="text"
          className="preferences-text-input"
          value={value.monoStack}
          onChange={e => set('monoStack', e.target.value)}
          placeholder="'JetBrains Mono', monospace"
        />
      </label>
      <label className="preferences-field-row">
        <span>Sans-serif UI font stack</span>
        <input
          type="text"
          className="preferences-text-input"
          value={value.sansStack}
          onChange={e => set('sansStack', e.target.value)}
          placeholder="-apple-system, sans-serif"
        />
      </label>
      <SliderRow label="UI base font size (px)" min={10} max={22} step={1} value={value.baseSize} onChange={v => set('baseSize', v)} />
      <SliderRow label="Chat transcript font size (px)" min={10} max={22} step={1} value={value.chatSize} onChange={v => set('chatSize', v)} />
    </div>
  );
}

function KeyboardSection({ value, onChange }: { value: KeyboardPreferences; onChange: (v: KeyboardPreferences) => void }) {
  const set = useCallback(
    <K extends keyof KeyboardPreferences>(key: K, val: KeyboardPreferences[K]) =>
      onChange({ ...value, [key]: val }),
    [value, onChange],
  );

  return (
    <div className="preferences-section">
      <h3>Keyboard shortcuts</h3>
      <label className="preferences-field-row">
        <span>Close latest panel</span>
        <input
          type="text"
          className="preferences-text-input"
          value={value.closePanel}
          onChange={e => set('closePanel', normalizeHotkey(e.target.value))}
          placeholder="Escape"
        />
      </label>
      <label className="preferences-field-row">
        <span>Open preferences</span>
        <input
          type="text"
          className="preferences-text-input"
          value={value.openPreferences}
          onChange={e => set('openPreferences', normalizeHotkey(e.target.value))}
          placeholder="Optional, e.g. ?"
        />
      </label>
      <p className="preferences-note">
        Use browser key names such as Escape, ?, or F2. Leave a field blank to disable that shortcut.
      </p>
    </div>
  );
}

function normalizeHotkey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === 'esc') return 'Escape';
  return trimmed.length === 1 ? trimmed : trimmed[0].toUpperCase() + trimmed.slice(1);
}

// ---------------------------------------------------------------------------
// Shared controls
// ---------------------------------------------------------------------------

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="preferences-slider-row">
      <span className="preferences-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <span className="preferences-slider-value">{value}</span>
    </label>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="preferences-color-row">
      <span className="preferences-color-label">{label}</span>
      <span className="preferences-color-swatch" style={{ background: value }} />
      <input
        type="color"
        className="preferences-color-input"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <input
        type="text"
        className="preferences-color-text"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}
