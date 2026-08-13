import { useEffect, useMemo, useState } from 'react'
import type { ViewerState, ViewerTransform } from '@/shared/viewer/contracts'
import './App.css'

const initial: ViewerState = {
  visible: false,
  activeImage: null,
  transform: { brightness: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
  window: { displayId: null, fullscreen: true, topmost: false },
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
  if (!state.activeImage) return <main className="output" />
  const transform = state.transform
  return (
    <main className="output">
      <img
        key={state.activeImage.url}
        src={state.activeImage.url}
        alt="Imagine onAIR"
        style={{
          filter: `brightness(${transform.brightness}%)`,
          transform: `translate(${transform.panX}%, ${transform.panY}%) scale(${transform.zoom}) scaleX(${transform.flipX ? -1 : 1})`,
        }}
      />
    </main>
  )
}

function Control({ state }: { state: ViewerState }) {
  const updateTransform = (patch: Partial<ViewerTransform>) => window.viewerApi.setTransform({ ...state.transform, ...patch })
  return (
    <main className="control-shell">
      <header className="topbar">
        <div><span className="eyebrow">PLASMA</span><h1>PlasmaViewer</h1></div>
        <span className={`status ${state.visible ? 'live' : ''}`}><i />{state.visible ? 'onAIR' : 'Output ascuns'}</span>
      </header>

      <section className="workspace">
        <div className="preview-card">
          <div className="preview">
            {state.activeImage ? <img src={state.activeImage.url} alt="Preview" style={imageStyle(state.transform)} /> : <div className="empty">Nicio imagine selectată din Plasma</div>}
          </div>
          <div className="preview-meta">
            <div><strong>{state.activeImage?.title ?? 'Fără imagine'}</strong><small>{state.activeImage ? `Articol #${state.activeImage.articleId}` : 'Apasă onAIR în playlist'}</small></div>
            <div className="actions">
              <button className="secondary" disabled={!state.activeImage} onClick={() => window.viewerApi.hideOutput()}>Ascunde</button>
              <button className="primary" disabled={!state.activeImage} onClick={() => window.viewerApi.showOutput()}>Afișează</button>
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
          <h2>Ajustări imagine</h2>
          <Range label="Luminozitate" value={state.transform.brightness} min={0} max={200} unit="%" onChange={brightness => updateTransform({ brightness })} />
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

function imageStyle(transform: ViewerTransform) {
  return { filter: `brightness(${transform.brightness}%)`, transform: `translate(${transform.panX}%, ${transform.panY}%) scale(${transform.zoom}) scaleX(${transform.flipX ? -1 : 1})` }
}

export default App
