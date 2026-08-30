import { useEffect, useMemo, useRef, useState } from 'react'
import { getViewerKeyboardAdjustment, maxViewerPanForZoom, type ViewerState, type ViewerTransform, type ViewerTransformDefaults } from '@/shared/viewer/contracts'
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
  return isOutput ? <Output state={state} /> : isFr3 ? <Background state={state} /> : <><Control state={state} hidden={page !== 'control'} page={page} onNavigate={setPage} /><Settings state={state} hidden={page !== 'settings'} page={page} onNavigate={setPage} /></>
}

function Navigation({ page, onChange }: { page: 'control' | 'settings'; onChange: (page: 'control' | 'settings') => void }) {
  return <nav className="viewer-navigation" aria-label="Navigare Viewer"><button className={page === 'control' ? 'active' : ''} onClick={() => onChange('control')}>Control</button><button className={page === 'settings' ? 'active' : ''} onClick={() => onChange('settings')}>Settings</button></nav>
}

function Brand() {
  return <div className="brand"><img src="/plasma-viewer-logo.png" alt="" /><span>PlasmaViewer</span></div>
}

function Output({ state }: { state: ViewerState }) {
  return (
    <main className="output" aria-label="Fereastră output FR2">
      <ImageLayers state={state} />
    </main>
  )
}

function ImageLayers({ state, preview = false }: { state: ViewerState; preview?: boolean }) {
  const [activeLayers, promoteActiveImage] = useActiveImageLayers(state.activeImage)
  const targetUrl = state.activeImage?.url ?? null

  if (!state.activeImage && !state.defaultImage) {
    return preview ? <div className="empty">Nicio imagine selectată din Plasma</div> : null
  }

  return (
    <div className="image-layers">
      {state.defaultImage && (
        <img
          className="default-image"
          src={state.defaultImage.url}
          alt="Imagine implicită"
          style={defaultImageStyle(state)}
        />
      )}
      {activeLayers.previous && targetUrl && (
        <img
          className="active-image previous-image"
          key={activeLayers.previous.image.url}
          src={activeLayers.previous.image.url}
          alt="Imagine onAIR"
          style={imageStyle(activeLayers.previous.transform)}
        />
      )}
      {activeLayers.current && targetUrl && (
        <img
          className="active-image current-image"
          key={activeLayers.current.image.url}
          src={activeLayers.current.image.url}
          alt="Imagine onAIR"
          style={imageStyle(activeLayers.current.image.url === targetUrl ? state.transform : activeLayers.current.transform)}
        />
      )}
      {state.activeImage && state.activeImage.url !== activeLayers.current?.image.url && (
        <img
          className="active-image pending-image"
          key={state.activeImage.url}
          src={state.activeImage.url}
          alt=""
          aria-hidden="true"
          style={imageStyle(state.transform)}
          onLoad={() => promoteActiveImage({ image: state.activeImage!, transform: state.transform })}
        />
      )}
    </div>
  )
}

function Control({ state, hidden, page, onNavigate }: { state: ViewerState; hidden: boolean; page: 'control' | 'settings'; onNavigate: (page: 'control' | 'settings') => void }) {
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
        <Brand />
        <Navigation page={page} onChange={onNavigate} />
        <div className="header-actions">
          <button className={`onair-control ${state.visible ? 'live' : ''}`} disabled={!state.visible} onClick={() => void window.viewerApi.disconnectOutputs()} aria-label="Deconectează ferestrele FR2 și FR3"><i /><span>{state.visible ? 'ON AIR' : 'OFF AIR'}</span>{state.visible && <b>DECONECTEAZĂ</b>}</button>
          <div className="output-menu">
            <button className="menu-trigger" aria-label="Setări fereastră output">Output <span aria-hidden="true">•••</span></button>
            <div className="output-menu-panel">
              <label>Monitor<select value={state.window.displayId ?? ''} onChange={(event) => window.viewerApi.setWindow({ displayId: event.target.value })}>
                {state.displays.map(display => <option key={display.id} value={display.id}>{display.label}{display.primary ? ' — principal' : ''}</option>)}
              </select></label>
              <Toggle label="Fullscreen" checked={state.window.fullscreen} onChange={checked => window.viewerApi.setWindow({ fullscreen: checked })} />
              <Toggle label="Întotdeauna deasupra" checked={state.window.topmost} onChange={checked => window.viewerApi.setWindow({ topmost: checked })} />
              <Toggle label="Fixează 16:9" checked={state.window.aspectMode === '16:9'} onChange={checked => window.viewerApi.setWindow({ aspectMode: checked ? '16:9' : 'free' })} />
            </div>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="preview-card">
          <div className="preview"><ImageLayers state={state} preview /></div>
          <div className="preview-meta">
            <div>
              <strong>{state.activeImage?.title ?? 'Fără imagine'}</strong>
              {!state.activeImage && <small>Apasă onAIR în playlist</small>}
              {state.activeImage && <small className="image-source">Sursă locală: {state.activeImage.source ?? 'Fișier local indisponibil'}</small>}
            </div>
            <div className="actions">
              <button className="secondary" disabled={!state.visible} onClick={() => window.viewerApi.hideOutput()}>Ascunde</button>
              <button className="primary" disabled={!canDisplay} onClick={() => window.viewerApi.showOutput()}>Afișează</button>
            </div>
          </div>
          <section className="geometry-card">
            <div className="section-heading"><div><h2>Poziție și dimensiune FR2</h2><p>Se aplică în modul windowed.</p></div><span className="geometry-mode">{state.window.aspectMode === '16:9' ? '16:9 blocat' : 'liber'}</span></div>
            <div className="window-bounds">
              <NumberField label="Stânga" value={state.window.bounds?.x ?? 0} onChange={x => updateWindowBounds(state, { x })} />
              <NumberField label="Sus" value={state.window.bounds?.y ?? 0} onChange={y => updateWindowBounds(state, { y })} />
              <NumberField label="Lățime" value={state.window.bounds?.width ?? 1280} min={320} onChange={width => updateWindowBounds(state, { width })} />
              <NumberField label="Înălțime" value={state.window.bounds?.height ?? 720} min={180} onChange={height => updateWindowBounds(state, { height })} />
            </div>
            <div className="keyboard-adjustment" ref={keyboardCaptureRef} tabIndex={-1} aria-label="Captură taste pentru ajustarea FR2">
              <button type="button" className={`keyboard-mode ${keyboardAdjustEnabled ? 'active' : ''}`} disabled={state.window.fullscreen} onClick={() => toggleKeyboardAdjust(!keyboardAdjustEnabled)}><span>Ajustare din taste</span><b>{keyboardAdjustEnabled ? 'ON' : 'OFF'}</b></button>
              {keyboardAdjustEnabled && <p className="hint">Săgeți mută · Ctrl + săgeți redimensionează · Shift: 10 px · Escape: oprește</p>}
            </div>
          </section>
        </div>

        <aside className="panel">
          <h2>Ajustări imagine plasma.test</h2>
          <Range label="Luminozitate" value={state.transform.brightness} min={0} max={200} unit="%" onChange={brightness => updateTransform({ brightness })} />
          <Range label="Contrast" value={state.transform.contrast} min={0} max={200} unit="%" onChange={contrast => updateTransform({ contrast })} />
          <Range label="Saturație" value={state.transform.saturation} min={0} max={200} unit="%" onChange={saturation => updateTransform({ saturation })} />
          <Range label="Zoom" value={state.transform.zoom} min={1} max={4} step={0.01} unit="×" onChange={zoom => updateTransform({ zoom })} />
          <Range label="Poziție X" value={state.transform.panX} min={-maxViewerPanForZoom(state.transform.zoom)} max={maxViewerPanForZoom(state.transform.zoom)} unit="%" onChange={panX => updateTransform({ panX })} />
          <Range label="Poziție Y" value={state.transform.panY} min={-maxViewerPanForZoom(state.transform.zoom)} max={maxViewerPanForZoom(state.transform.zoom)} unit="%" onChange={panY => updateTransform({ panY })} />
          <Toggle label="Flip orizontal" checked={state.transform.flipX} onChange={flipX => updateTransform({ flipX })} />
          <button className="reset" onClick={() => window.viewerApi.resetTransform()}>Resetează ajustările</button>
        </aside>
      </section>
      {state.error && <div className="error">{state.error}</div>}
    </main>
  )
}

type DisplayedActiveImage = { image: NonNullable<ViewerState['activeImage']>; transform: ViewerTransform }

function useActiveImageLayers(activeImage: ViewerState['activeImage']) {
  const [layers, setLayers] = useState<{ current: DisplayedActiveImage | null; previous: DisplayedActiveImage | null }>({ current: null, previous: null })
  const cleanupFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!activeImage) {
      if (cleanupFrameRef.current !== null) cancelAnimationFrame(cleanupFrameRef.current)
      cleanupFrameRef.current = null
      setLayers({ current: null, previous: null })
    }
  }, [activeImage?.url])

  useEffect(() => () => {
    if (cleanupFrameRef.current !== null) cancelAnimationFrame(cleanupFrameRef.current)
  }, [])

  const promote = (next: DisplayedActiveImage) => {
    setLayers(current => current.current?.image.url === next.image.url
      ? current
      : { current: next, previous: current.current })

    if (cleanupFrameRef.current !== null) cancelAnimationFrame(cleanupFrameRef.current)
    cleanupFrameRef.current = requestAnimationFrame(() => {
      cleanupFrameRef.current = requestAnimationFrame(() => {
        setLayers(current => ({ ...current, previous: null }))
        cleanupFrameRef.current = null
      })
    })
  }

  return [layers, promote] as const
}

function Background({ state }: { state: ViewerState }) {
  if (!state.defaultImage) return <main className="output" aria-label="Fereastră fundal FR3" />
  return <main className="output" aria-label="Fereastră fundal FR3"><img className="default-image" src={state.defaultImage.url} alt="Imagine implicită FR3" style={defaultImageStyle(state)} /></main>
}

function Settings({ state, hidden, page, onNavigate }: { state: ViewerState; hidden: boolean; page: 'control' | 'settings'; onNavigate: (page: 'control' | 'settings') => void }) {
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
    <header className="topbar"><Brand /><Navigation page={page} onChange={onNavigate} /><span className="settings-label">Settings</span></header>
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

function defaultImageStyle(state: ViewerState) {
  const { brightness, contrast, saturation } = state.fr3.transform
  return { filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` }
}

function pickDefaults(state: ViewerState): ViewerTransformDefaults {
  const { brightness, contrast, saturation } = state.transformDefaults
  return { brightness, contrast, saturation }
}

function isValidDefaults(value: ViewerTransformDefaults) {
  return [value.brightness, value.contrast, value.saturation].every(item => Number.isFinite(item) && item >= 0 && item <= 200)
}

export default App
