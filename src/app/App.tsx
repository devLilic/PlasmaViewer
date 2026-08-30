import { useEffect, useMemo, useState } from 'react'
import type { ViewerState, ViewerTransform } from '@/shared/viewer/contracts'
import './App.css'

const initial: ViewerState = {
  visible: false,
  activeImage: null,
  defaultImage: null,
  transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
  transformDefaults: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
  window: { displayId: null, fullscreen: true, topmost: false, bounds: null, aspectMode: 'free' },
  fr3: { enabled: false, visible: false },
  displays: [],
  lastCommandId: null,
  error: null,
}

function App() {
  const [state, setState] = useState(initial)
  const isOutput = useMemo(() => new URLSearchParams(window.location.search).get('view') === 'output', [])

  useEffect(() => {
    void window.viewerApi.getState().then(setState)
    return window.viewerApi.onStateChanged(setState)
  }, [])

  return isOutput ? <Output state={state} /> : <Control state={state} />
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
  const targetUrl = state.activeImage?.url ?? state.defaultImage?.url ?? null
  const loading = Boolean(targetUrl && !loadedUrls.has(targetUrl))
  const markLoaded = (url: string) => setLoadedUrls(current => new Set(current).add(url))

  if (!state.defaultImage && !state.activeImage) {
    return preview ? <div className="empty">Nicio imagine selectată din Plasma</div> : null
  }

  return (
    <div className="image-layers" aria-busy={loading}>
      {loading && <div className="viewer-image-loader" aria-hidden="true"><span /></div>}
      {state.defaultImage && (
        <img
          className="default-image"
          key={state.defaultImage.url}
          src={state.defaultImage.url}
          alt="Imagine implicită"
          onLoad={() => markLoaded(state.defaultImage!.url)}
          onError={() => markLoaded(state.defaultImage!.url)}
        />
      )}
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

function Control({ state }: { state: ViewerState }) {
  const updateTransform = (patch: Partial<ViewerTransform>) => window.viewerApi.setTransform({ ...state.transform, ...patch })
  const canDisplay = Boolean(state.activeImage || state.defaultImage)

  return (
    <main className="control-shell">
      <header className="topbar">
        <div><span className="eyebrow">PLASMA</span><h1>PlasmaViewer</h1></div>
        <span className={`status ${state.visible ? 'live' : ''}`}><i />{state.visible ? 'onAIR' : 'Output ascuns'}</span>
      </header>

      <section className="workspace">
        <div className="preview-card">
          <div className="preview"><ImageLayers state={state} preview /></div>
          <div className="preview-meta">
            <div>
              <strong>{state.activeImage?.title ?? state.defaultImage?.name ?? 'Fără imagine'}</strong>
              <small>{state.activeImage ? `Articol #${state.activeImage.articleId}` : state.defaultImage ? 'Imagine implicită FR2' : 'Apasă onAIR în playlist'}</small>
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

          <div className="divider" />
          <h2>Poziție și dimensiune FR2</h2>
          <p className="hint">Aceste valori se aplică atunci când fullscreen este dezactivat și sunt păstrate după repornire.</p>
          <div className="window-bounds">
            <NumberField label="Stânga" value={state.window.bounds?.x ?? 0} onChange={x => updateWindowBounds(state, { x })} />
            <NumberField label="Sus" value={state.window.bounds?.y ?? 0} onChange={y => updateWindowBounds(state, { y })} />
            <NumberField label="Lățime" value={state.window.bounds?.width ?? 1280} min={320} onChange={width => updateWindowBounds(state, { width })} />
            <NumberField label="Înălțime" value={state.window.bounds?.height ?? 720} min={180} onChange={height => updateWindowBounds(state, { height })} />
          </div>

          <div className="divider" />
          <h2>Imagine implicită FR2</h2>
          <p className="default-image-name">{state.defaultImage?.name ?? 'Nicio imagine configurată'}</p>
          <div className="default-image-actions">
            <button className="secondary" onClick={() => window.viewerApi.chooseDefaultImage()}>Alege imaginea</button>
            <button className="danger" disabled={!state.defaultImage} onClick={() => window.viewerApi.clearDefaultImage()}>Elimină</button>
          </div>
          <p className="hint">Imaginea implicită rămâne fixă în fundal. Ajustările de mai jos se aplică numai imaginii primite din plasma.test.</p>

          <div className="divider" />
          <h2>Ajustări imagine plasma.test</h2>
          <Range label="Luminozitate" value={state.transform.brightness} min={0} max={200} unit="%" onChange={brightness => updateTransform({ brightness })} />
          <Range label="Contrast" value={state.transform.contrast} min={0} max={200} unit="%" onChange={contrast => updateTransform({ contrast })} />
          <Range label="Zoom" value={state.transform.zoom} min={1} max={4} step={0.01} unit="×" onChange={zoom => updateTransform({ zoom })} />
          <Range label="Poziție X" value={state.transform.panX} min={-100} max={100} unit="%" onChange={panX => updateTransform({ panX })} />
          <Range label="Poziție Y" value={state.transform.panY} min={-100} max={100} unit="%" onChange={panY => updateTransform({ panY })} />
          <Toggle label="Flip orizontal" checked={state.transform.flipX} onChange={flipX => updateTransform({ flipX })} />
          <button className="reset" onClick={() => window.viewerApi.resetTransform()}>Resetează ajustările</button>
        </aside>
      </section>
      {state.error && <div className="error">{state.error}</div>}
    </main>
  )
}

function Range({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="range"><span>{label}<b>{value.toFixed(step < 1 ? 2 : 0)}{unit}</b></span><input type="range" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} /></label>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><i /></label>
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
  void window.viewerApi.setWindow({ bounds })
}

function imageStyle(transform: ViewerTransform) {
  return {
    filter: `brightness(${transform.brightness}%) contrast(${transform.contrast}%)`,
    transform: `translate(${transform.panX}%, ${transform.panY}%) scale(${transform.zoom}) scaleX(${transform.flipX ? -1 : 1})`,
  }
}

export default App
