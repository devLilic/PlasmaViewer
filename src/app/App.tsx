import { useEffect, useMemo, useRef, useState } from 'react'
import { getViewerKeyboardAdjustment, type ViewerState, type ViewerTransform, type ViewerTransformDefaults } from '@/shared/viewer/contracts'
import './App.css'

const initial: ViewerState = {
  visible: false,
  activeImage: null,
  defaultImage: null,
  transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
  transformDefaults: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
  window: { displayId: null, fullscreen: true, topmost: false, bounds: null, aspectMode: 'free' },
  fr3: { enabled: false, visible: false, transform: { brightness: 100, contrast: 100, saturation: 100 } },
  displays: [],
  lastCommandId: null,
  error: null,
}

function App() {
  const [state, setState] = useState(initial)
  const [page, setPage] = useState<'control' | 'settings'>('control')
  const isOutput = useMemo(() => new URLSearchParams(window.location.search).get('view') === 'output', [])

  useEffect(() => {
    void window.viewerApi.getState().then(setState)
    return window.viewerApi.onStateChanged(setState)
  }, [])

  const isFr3 = useMemo(() => new URLSearchParams(window.location.search).get('view') === 'fr3', [])
  return isOutput ? <Output state={state} /> : isFr3 ? <Background state={state} /> : <><Navigation page={page} onChange={setPage} /><Control state={state} hidden={page !== 'control'} /><Settings state={state} hidden={page !== 'settings'} /></>
}

function Navigation({ page, onChange }: { page: 'control' | 'settings'; onChange: (page: 'control' | 'settings') => void }) {
  return <nav className="viewer-navigation" aria-label="Navigare Viewer"><button className={page === 'control' ? 'active' : ''} onClick={() => onChange('control')}>Control</button><button className={page === 'settings' ? 'active' : ''} onClick={() => onChange('settings')}>Settings</button></nav>
}

function Output({ state }: { state: ViewerState }) {
  return (
    <main className="output" aria-label="Fereastră output FR2">
      <ImageLayers state={state} />
    </main>
  )
}

function ImageLayers({ state, preview = false }: { state: ViewerState; preview?: boolean }) {
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set())
  const targetUrl = state.activeImage?.url ?? null
  const loading = Boolean(targetUrl && !loadedUrls.has(targetUrl))
  const markLoaded = (url: string) => setLoadedUrls(current => new Set(current).add(url))

  if (!state.activeImage) {
    return preview ? <div className="empty">Nicio imagine selectată din Plasma</div> : null
  }

  return (
    <div className="image-layers" aria-busy={loading}>
      {loading && <div className="viewer-image-loader" aria-hidden="true"><span /></div>}
      {state.activeImage && (
        <img
          className="active-image"
          key={state.activeImage.url}
          src={state.activeImage.url}
          alt="Imagine onAIR"
          style={imageStyle(state.transform)}
          onLoad={() => markLoaded(state.activeImage!.url)}
          onError={() => markLoaded(state.activeImage!.url)}
        />
      )}
    </div>
  )
}

function Control({ state, hidden }: { state: ViewerState; hidden: boolean }) {
  const updateTransform = (patch: Partial<ViewerTransform>) => window.viewerApi.setTransform({ ...state.transform, ...patch })
  const canDisplay = Boolean(state.activeImage)
  const [keyboardAdjustEnabled, setKeyboardAdjustEnabled] = useState(false)
  const keyboardCaptureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hidden || state.window.fullscreen) setKeyboardAdjustEnabled(false)
  }, [hidden, state.window.fullscreen])

  useEffect(() => {
    if (!keyboardAdjustEnabled || hidden || state.window.fullscreen) return
    const onBlur = () => setKeyboardAdjustEnabled(false)
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const adjustment = getViewerKeyboardAdjustment(event)
      if (!adjustment) return
      event.preventDefault()
      if (adjustment.type === 'disable') return setKeyboardAdjustEnabled(false)
      const current = state.window.bounds ?? { x: 0, y: 0, width: 1280, height: 720 }
      const bounds = addBoundsPatch(current, adjustment.patch)
      void window.viewerApi.setWindow({ bounds, boundsChangedDimension: adjustment.boundsChangedDimension })
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [keyboardAdjustEnabled, hidden, state.window.bounds, state.window.fullscreen])

  const toggleKeyboardAdjust = (enabled: boolean) => {
    setKeyboardAdjustEnabled(enabled)
    if (enabled) requestAnimationFrame(() => keyboardCaptureRef.current?.focus())
  }

  return (
    <main className="control-shell" hidden={hidden}>
      <header className="topbar">
        <div><span className="eyebrow">PLASMA</span><h1>PlasmaViewer</h1></div>
        <span className={`status ${state.visible ? 'live' : ''}`}><i />{state.visible ? 'onAIR' : 'Output ascuns'}</span>
      </header>

      <section className="workspace">
        <div className="preview-card">
          <div className="preview"><ImageLayers state={state} preview /></div>
          <div className="preview-meta">
            <div>
              <strong>{state.activeImage?.title ?? 'Fără imagine'}</strong>
              <small>{state.activeImage ? `Articol #${state.activeImage.articleId}` : 'Apasă onAIR în playlist'}</small>
              {state.activeImage && <small className="image-source">Sursă locală: {state.activeImage.source ?? 'Fișier local indisponibil'}</small>}
            </div>
            <div className="actions">
              <button className="secondary" disabled={!state.visible} onClick={() => window.viewerApi.hideOutput()}>Ascunde</button>
              <button className="primary" disabled={!canDisplay} onClick={() => window.viewerApi.showOutput()}>Afișează</button>
            </div>
          </div>
        </div>

        <aside className="panel">
          <h2>Fereastră output</h2>
          <label>Monitor<select value={state.window.displayId ?? ''} onChange={(event) => window.viewerApi.setWindow({ displayId: event.target.value })}>
            {state.displays.map(display => <option key={display.id} value={display.id}>{display.label}{display.primary ? ' — principal' : ''}</option>)}
          </select></label>
          <Toggle label="Fullscreen" checked={state.window.fullscreen} onChange={checked => window.viewerApi.setWindow({ fullscreen: checked })} />
          <Toggle label="Întotdeauna deasupra" checked={state.window.topmost} onChange={checked => window.viewerApi.setWindow({ topmost: checked })} />
          <Toggle label="Fixează 16:9" checked={state.window.aspectMode === '16:9'} onChange={checked => window.viewerApi.setWindow({ aspectMode: checked ? '16:9' : 'free' })} />

          <div className="divider" />
          <h2>Ajustări imagine plasma.test</h2>
          <Range label="Luminozitate" value={state.transform.brightness} min={0} max={200} unit="%" onChange={brightness => updateTransform({ brightness })} />
          <Range label="Contrast" value={state.transform.contrast} min={0} max={200} unit="%" onChange={contrast => updateTransform({ contrast })} />
          <Range label="Saturație" value={state.transform.saturation} min={0} max={200} unit="%" onChange={saturation => updateTransform({ saturation })} />
          <Range label="Zoom" value={state.transform.zoom} min={1} max={4} step={0.01} unit="×" onChange={zoom => updateTransform({ zoom })} />
          <Range label="Poziție X" value={state.transform.panX} min={-100} max={100} unit="%" onChange={panX => updateTransform({ panX })} />
          <Range label="Poziție Y" value={state.transform.panY} min={-100} max={100} unit="%" onChange={panY => updateTransform({ panY })} />
          <Toggle label="Flip orizontal" checked={state.transform.flipX} onChange={flipX => updateTransform({ flipX })} />
          <button className="reset" onClick={() => window.viewerApi.resetTransform()}>Resetează ajustările</button>

          <div className="divider" />
          <h2>Poziție și dimensiune FR2</h2>
          <p className="hint">Aceste valori se aplică atunci când fullscreen este dezactivat și sunt păstrate după repornire.</p>
          <div className="window-bounds">
            <NumberField label="Stânga" value={state.window.bounds?.x ?? 0} onChange={x => updateWindowBounds(state, { x })} />
            <NumberField label="Sus" value={state.window.bounds?.y ?? 0} onChange={y => updateWindowBounds(state, { y })} />
            <NumberField label="Lățime" value={state.window.bounds?.width ?? 1280} min={320} onChange={width => updateWindowBounds(state, { width })} />
            <NumberField label="Înălțime" value={state.window.bounds?.height ?? 720} min={180} onChange={height => updateWindowBounds(state, { height })} />
          </div>
          <div className="keyboard-adjustment" ref={keyboardCaptureRef} tabIndex={-1} aria-label="Captură taste pentru ajustarea FR2">
            <Toggle label="Ajustare din taste" checked={keyboardAdjustEnabled} onChange={toggleKeyboardAdjust} disabled={state.window.fullscreen} />
            {keyboardAdjustEnabled && <p className="hint">Săgeți: poziție · Ctrl + săgeți: dimensiune · Shift: 10 px · Escape: oprește modul</p>}
          </div>
        </aside>
      </section>
      {state.error && <div className="error">{state.error}</div>}
    </main>
  )
}

function Background({ state }: { state: ViewerState }) {
  if (!state.defaultImage) return <main className="output" aria-label="Fereastră fundal FR3" />
  const { brightness, contrast, saturation } = state.fr3.transform
  return <main className="output" aria-label="Fereastră fundal FR3"><img className="default-image" src={state.defaultImage.url} alt="Imagine implicită FR3" style={{ filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` }} /></main>
}

function Settings({ state, hidden }: { state: ViewerState; hidden: boolean }) {
  const [draft, setDraft] = useState<ViewerTransformDefaults>(pickDefaults(state))
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const persisted = pickDefaults(state)
  const valid = isValidDefaults(draft)
  const changed = draft.brightness !== persisted.brightness || draft.contrast !== persisted.contrast || draft.saturation !== persisted.saturation

  useEffect(() => {
    if (!saving) setDraft(pickDefaults(state))
  }, [state.transformDefaults.brightness, state.transformDefaults.contrast, state.transformDefaults.saturation, saving])

  const save = async () => {
    if (!valid || !changed) return
    setSaving(true)
    setNotice(null)
    try {
      await window.viewerApi.setTransformDefaults(draft)
      setNotice('Defaulturile au fost salvate.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Defaulturile nu au putut fi salvate.')
    } finally {
      setSaving(false)
    }
  }

  return <main className="control-shell" hidden={hidden}>
    <header className="topbar"><div><span className="eyebrow">PLASMA</span><h1>Settings</h1></div></header>
    <section className="settings-layout">
      <section className="panel settings-panel">
        <h2>Imagine implicită FR3</h2>
        <p className="default-image-name">{state.defaultImage?.name ?? 'Nicio imagine configurată'}</p>
        <div className="default-image-actions">
          <button className="secondary" onClick={() => void window.viewerApi.chooseDefaultImage().catch(error => setNotice(error instanceof Error ? error.message : 'Imaginea nu a putut fi selectată.'))}>Alege imaginea</button>
          <button className="danger" disabled={!state.defaultImage} onClick={() => void window.viewerApi.clearDefaultImage().catch(error => setNotice(error instanceof Error ? error.message : 'Imaginea nu a putut fi eliminată.'))}>Elimină</button>
        </div>
        <p className="hint">Imaginea este salvată imediat după alegere și va fi utilizată de FR3 când fereastra va fi activată.</p>
        <Toggle label="Activează FR3" checked={state.fr3.enabled} onChange={enabled => void window.viewerApi.setFr3({ enabled, transform: state.fr3.transform })} />
        <Range label="Luminozitate FR3" value={state.fr3.transform.brightness} min={0} max={200} unit="%" onChange={brightness => void window.viewerApi.setFr3({ enabled: state.fr3.enabled, transform: { ...state.fr3.transform, brightness } })} />
        <Range label="Contrast FR3" value={state.fr3.transform.contrast} min={0} max={200} unit="%" onChange={contrast => void window.viewerApi.setFr3({ enabled: state.fr3.enabled, transform: { ...state.fr3.transform, contrast } })} />
        <Range label="Saturație FR3" value={state.fr3.transform.saturation} min={0} max={200} unit="%" onChange={saturation => void window.viewerApi.setFr3({ enabled: state.fr3.enabled, transform: { ...state.fr3.transform, saturation } })} />

        <div className="divider" />
        <h2>Defaulturi FR2 pentru imagini onAIR</h2>
        <p className="hint">Se aplică la resetare și pentru inițializările următoare; nu modifică imaginea onAIR curentă.</p>
        <Range label="Luminozitate" value={draft.brightness} min={0} max={200} unit="%" onChange={brightness => setDraft(current => ({ ...current, brightness }))} />
        <Range label="Contrast" value={draft.contrast} min={0} max={200} unit="%" onChange={contrast => setDraft(current => ({ ...current, contrast }))} />
        <Range label="Saturație" value={draft.saturation} min={0} max={200} unit="%" onChange={saturation => setDraft(current => ({ ...current, saturation }))} />
        {!valid && <p className="validation-error">Valorile trebuie să fie între 0% și 200%.</p>}
        {changed && <p className="unsaved">Modificări nesalvate.</p>}
        <button className="primary save-defaults" disabled={!valid || !changed || saving} onClick={() => void save()}>{saving ? 'Se salvează…' : 'Salvează'}</button>
        {notice && <p className="settings-notice">{notice}</p>}
      </section>
    </section>
  </main>
}

function Range({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="range"><span>{label}<b>{value.toFixed(step < 1 ? 2 : 0)}{unit}</b></span><input type="range" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} /></label>
}

function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><i /></label>
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const next = Number(draft)
    if (!Number.isFinite(next) || (min !== undefined && next < min)) return setDraft(String(value))
    onChange(Math.round(next))
  }
  return <label className="number-field"><span>{label}</span><input type="number" value={draft} min={min} step="1" onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
}

function updateWindowBounds(state: ViewerState, patch: Partial<NonNullable<ViewerState['window']['bounds']>>) {
  const bounds = { x: 0, y: 0, width: 1280, height: 720, ...state.window.bounds, ...patch }
  const boundsChangedDimension = Object.hasOwn(patch, 'height') ? 'height' : 'width'
  void window.viewerApi.setWindow({ bounds, boundsChangedDimension })
}

function addBoundsPatch(bounds: NonNullable<ViewerState['window']['bounds']>, patch: Partial<NonNullable<ViewerState['window']['bounds']>>) {
  return {
    x: bounds.x + (patch.x ?? 0),
    y: bounds.y + (patch.y ?? 0),
    width: bounds.width + (patch.width ?? 0),
    height: bounds.height + (patch.height ?? 0),
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

function imageStyle(transform: ViewerTransform) {
  return {
    filter: `brightness(${transform.brightness}%) contrast(${transform.contrast}%) saturate(${transform.saturation}%)`,
    transform: `translate(${transform.panX}%, ${transform.panY}%) scale(${transform.zoom}) scaleX(${transform.flipX ? -1 : 1})`,
  }
}

function pickDefaults(state: ViewerState): ViewerTransformDefaults {
  const { brightness, contrast, saturation } = state.transformDefaults
  return { brightness, contrast, saturation }
}

function isValidDefaults(value: ViewerTransformDefaults) {
  return [value.brightness, value.contrast, value.saturation].every(item => Number.isFinite(item) && item >= 0 && item <= 200)
}

export default App
