import { useEffect, useMemo, useRef, useState } from 'react'
import { getViewerKeyboardAdjustment, maxViewerPanForZoom, type ViewerState, type ViewerTransform, type ViewerTransformDefaults } from '@/shared/viewer/contracts'
import { useTranslation } from 'react-i18next'
import './App.css'

const initial: ViewerState = {
  visible: false,
  activeImage: null,
  defaultImage: null,
  transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
  transformDefaults: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
  window: { displayId: null, fullscreen: true, topmost: false, bounds: null, aspectMode: 'free' },
  fr3: { enabled: false, visible: false, displayId: null, selectedBackgroundId: null, activeBackgroundId: null, transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false } },
  backgrounds: [],
  outputOrder: { fr2: 3, fr3: 1 },
  displays: [],
  lastCommandId: null,
  error: null,
}

function App() {
  const [state, setState] = useState(initial)
  const [page, setPage] = useState<'control' | 'settings'>('control')
  const isOutput = useMemo(() => new URLSearchParams(window.location.search).get('view') === 'output', [])

  useEffect(() => {
    void window.viewerApi.getState().then(setState).catch(() => undefined)
    return window.viewerApi.onStateChanged(setState)
  }, [])

  const isFr3 = useMemo(() => new URLSearchParams(window.location.search).get('view') === 'fr3', [])
  return isOutput ? <Output state={state} /> : isFr3 ? <Background state={state} /> : <><Control state={state} hidden={page !== 'control'} page={page} onNavigate={setPage} /><Settings state={state} hidden={page !== 'settings'} page={page} onNavigate={setPage} /></>
}

function Navigation({ page, onChange }: { page: 'control' | 'settings'; onChange: (page: 'control' | 'settings') => void }) {
  return <nav className="viewer-navigation" aria-label="Navigare Viewer"><button className={page === 'control' ? 'active' : ''} onClick={() => onChange('control')}>Control</button><button className={page === 'settings' ? 'active' : ''} onClick={() => onChange('settings')}>Settings</button></nav>
}

function Brand() {
  return <div className="brand"><img src={`${import.meta.env.BASE_URL}plasma-viewer-logo.png`} alt="" /><span>PlasmaVu</span></div>
}

function Output({ state }: { state: ViewerState }) {
  return (
    <main className="output" aria-label="Fereastră output FR2">
      <ImageLayers state={state} />
    </main>
  )
}

function ImageLayers({ state, preview = false }: { state: ViewerState; preview?: boolean }) {
  const { t } = useTranslation()
  const [activeLayers, promoteActiveImage] = useActiveImageLayers(state.activeImage, state.transform)
  const targetUrl = state.activeImage?.url ?? null

  if (!state.activeImage) {
    return preview ? <div className="empty">{t('viewer.fr2.empty', { defaultValue: 'Nicio imagine selectată din Plasma' })}</div> : null
  }

  return (
    <div className="image-layers">
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
  const { t } = useTranslation()
  const [notice, setNotice] = useState<string | null>(null)
  const updateTransform = (patch: Partial<ViewerTransform>) => runAction(window.viewerApi.setTransform({ ...state.transform, ...patch }), setNotice)
  const updateFr3 = (patch: Partial<ViewerTransform>) => runAction(window.viewerApi.setFr3({ transform: { ...state.fr3.transform, ...patch } }), setNotice)
  const canDisplay = Boolean(state.activeImage)
  const outputsLive = state.visible || state.fr3.visible
  const selectedBackground = state.backgrounds.find(background => background.id === state.fr3.selectedBackgroundId) ?? null
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
      void runAction(window.viewerApi.setWindow({ bounds, boundsChangedDimension: adjustment.boundsChangedDimension }), setNotice)
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
          <button className={`onair-control ${outputsLive ? 'live' : ''}`} disabled={!outputsLive} onClick={() => void runAction(window.viewerApi.disconnectOutputs(), setNotice)} aria-label="Deconectează ferestrele FR2 și FR3"><i /><span>{outputsLive ? 'ON AIR' : 'OFF AIR'}</span>{outputsLive && <b>DECONECTEAZĂ</b>}</button>
        </div>
      </header>

      <section className="workspace" aria-label={t('viewer.columns', { defaultValue: 'Previzualizări FR2 și FR3' })}>
        <article className="output-column fr2-column" aria-labelledby="fr2-heading">
          <div className="preview-card">
            <div className="preview-card-heading">
              <h1 id="fr2-heading" className="column-title">FR2</h1>
              <div className="window-mode-actions" role="group" aria-label="Mod afișare FR2">
                <button type="button" className={`window-mode-button ${state.window.fullscreen ? 'active' : ''}`} aria-label="Afișează FR2 pe tot ecranul" title="Fullscreen FR2" onClick={() => void runAction(window.viewerApi.setWindow({ fullscreen: true }), setNotice)}><FullscreenIcon /></button>
                <button type="button" className={`window-mode-button ${!state.window.fullscreen ? 'active' : ''}`} aria-label="Afișează FR2 în fereastră" title="Windowed FR2" onClick={() => void runAction(window.viewerApi.setWindow({ fullscreen: false }), setNotice)}><WindowedIcon /></button>
              </div>
            </div>
            <div className="preview"><ImageLayers state={state} preview /></div>
            <div className="preview-meta">
              <div><strong>{state.activeImage?.title ?? 'Fără imagine'}</strong>{!state.activeImage && <small>Apasă onAIR în playlist</small>}{state.activeImage && <small className="image-source">Sursă locală: {state.activeImage.source ?? 'Fișier local indisponibil'}</small>}</div>
              <div className="actions">
                <button className="secondary" disabled={!state.visible} onClick={() => void runAction(window.viewerApi.hideOutput(), setNotice)}>Ascunde</button>
                <button className="primary" disabled={!canDisplay} onClick={() => void runAction(window.viewerApi.showOutput(), setNotice)}>Afișează</button>
              </div>
            </div>
          </div>
          <section className="geometry-card">
            <div className="section-heading"><div><h2>Poziție și dimensiune FR2</h2><p>Se aplică în modul windowed.</p></div><span className="geometry-mode">{state.window.aspectMode === '16:9' ? '16:9 blocat' : 'liber'}</span></div>
            <div className="window-bounds">
              <NumberField label="Stânga" value={state.window.bounds?.x ?? 0} onChange={x => updateWindowBounds(state, { x }, setNotice)} />
              <NumberField label="Sus" value={state.window.bounds?.y ?? 0} onChange={y => updateWindowBounds(state, { y }, setNotice)} />
              <NumberField label="Lățime" value={state.window.bounds?.width ?? 1280} min={320} onChange={width => updateWindowBounds(state, { width }, setNotice)} />
              <NumberField label="Înălțime" value={state.window.bounds?.height ?? 720} min={180} onChange={height => updateWindowBounds(state, { height }, setNotice)} />
            </div>
            <div className="keyboard-adjustment" ref={keyboardCaptureRef} tabIndex={-1} aria-label="Captură taste pentru ajustarea FR2">
              <button type="button" className={`keyboard-mode ${keyboardAdjustEnabled ? 'active' : ''}`} disabled={state.window.fullscreen} onClick={() => toggleKeyboardAdjust(!keyboardAdjustEnabled)}><span>Ajustare din taste</span><b>{keyboardAdjustEnabled ? 'ON' : 'OFF'}</b></button>
              {keyboardAdjustEnabled && <p className="hint">{t('viewer.fr2.keyboardHint', { defaultValue: 'Săgeți mută 10 px · Ctrl + săgeți redimensionează · Shift: 50 px · Escape: oprește' })}</p>}
            </div>
          </section>
          <details className="panel transform-panel">
            <summary className="adjustment-summary">Ajustări imagine plasma.test</summary>
            <Range label="Luminozitate" value={state.transform.brightness} min={0} max={200} unit="%" onChange={brightness => updateTransform({ brightness })} />
            <Range label="Contrast" value={state.transform.contrast} min={0} max={200} unit="%" onChange={contrast => updateTransform({ contrast })} />
            <Range label="Saturație" value={state.transform.saturation} min={0} max={200} unit="%" onChange={saturation => updateTransform({ saturation })} />
            <Range label="Zoom" value={state.transform.zoom} min={1} max={4} step={0.01} unit="×" onChange={zoom => updateTransform({ zoom })} />
            <Range label="Poziție X" value={state.transform.panX} min={-maxViewerPanForZoom(state.transform.zoom)} max={maxViewerPanForZoom(state.transform.zoom)} unit="%" onChange={panX => updateTransform({ panX })} />
            <Range label="Poziție Y" value={state.transform.panY} min={-maxViewerPanForZoom(state.transform.zoom)} max={maxViewerPanForZoom(state.transform.zoom)} unit="%" onChange={panY => updateTransform({ panY })} />
            <Toggle label="Flip orizontal" checked={state.transform.flipX} onChange={flipX => updateTransform({ flipX })} />
            <button className="reset" onClick={() => void runAction(window.viewerApi.resetTransform(), setNotice)}>Resetează ajustările</button>
          </details>
          <section className="geometry-card window-settings-card" aria-label="Setări fereastră FR2">
            <div className="window-settings-heading"><h2>{t('viewer.fr2.windowSettings', { defaultValue: 'Fereastră FR2' })}</h2></div>
            <Toggle label="Întotdeauna deasupra" checked={state.window.topmost} onChange={checked => void runAction(window.viewerApi.setWindow({ topmost: checked }), setNotice)} />
            <Toggle label="Fixează 16:9" checked={state.window.aspectMode === '16:9'} onChange={checked => void runAction(window.viewerApi.setWindow({ aspectMode: checked ? '16:9' : 'free' }), setNotice)} />
          </section>
        </article>

        <article className="output-column fr3-column" aria-labelledby="fr3-heading">
          <div className="preview-card">
            <div className="preview-card-heading"><h1 id="fr3-heading" className="column-title">FR3</h1><span className="preview-heading-spacer" aria-hidden="true" /></div>
            <div className="preview fr3-preview" aria-label={t('viewer.fr3.preview', { defaultValue: 'Previzualizare fundal FR3' })}>
              {selectedBackground?.available ? <BackgroundImage selected={selectedBackground} transform={state.fr3.transform} onError={() => setNotice(t('viewer.fr3.imageLoadError', { defaultValue: 'Imaginea nu a putut fi încărcată.' }))} /> : <div className="empty">{t('viewer.fr3.noSelection', { defaultValue: 'Selectează un fundal din galerie' })}</div>}
              <span className={`preview-badge ${state.fr3.visible && selectedBackground?.id === state.fr3.activeBackgroundId ? 'applied' : ''}`}>{state.fr3.visible && selectedBackground?.id === state.fr3.activeBackgroundId ? t('viewer.fr3.live', { defaultValue: 'LIVE' }) : t('viewer.fr3.previewOnly', { defaultValue: 'PREVIEW' })}</span>
            </div>
            <div className="preview-meta fr3-preview-meta">
              <div><strong>{selectedBackground?.name ?? t('viewer.fr3.noSelection', { defaultValue: 'Selectează un fundal din galerie' })}</strong><small>{state.fr3.visible ? t('viewer.fr3.visible', { defaultValue: 'FR3 este afișat' }) : t('viewer.fr3.hidden', { defaultValue: 'FR3 este ascuns' })}</small></div>
              <div className="actions"><button className="secondary" disabled={!state.fr3.enabled} onClick={() => void runAction(window.viewerApi.hideFr3(), setNotice)}>{t('viewer.hide', { defaultValue: 'Ascunde' })}</button><button className="primary" disabled={!selectedBackground?.available} onClick={() => void runAction(window.viewerApi.showFr3(), setNotice)}>{t('viewer.show', { defaultValue: 'Afișează' })}</button></div>
            </div>
          </div>
          <section className="gallery-card" aria-label={t('viewer.fr3.gallery', { defaultValue: 'Galerie locală FR3' })}>
            <div className="gallery-heading"><div><h2>{t('viewer.fr3.gallery', { defaultValue: 'Galerie locală FR3' })}</h2><p>{t('viewer.fr3.galleryHint', { defaultValue: 'Selectarea schimbă doar previzualizarea.' })}</p></div><button className="secondary import-button" onClick={() => void runAction(window.viewerApi.importBackgrounds(), setNotice)}>{t('viewer.fr3.addFiles', { defaultValue: 'Adaugă fișiere' })}</button></div>
            <div className="background-gallery">
              {state.backgrounds.length === 0 && <p className="gallery-empty">{t('viewer.fr3.emptyGallery', { defaultValue: 'Galeria este goală. Adaugă imagini pentru FR3.' })}</p>}
              {state.backgrounds.map(background => <BackgroundTile key={background.id} background={background} selected={background.id === state.fr3.selectedBackgroundId} applied={background.id === state.fr3.activeBackgroundId} onSelect={() => void runAction(window.viewerApi.selectBackground(background.id), setNotice)} onRemove={() => void runAction(window.viewerApi.removeBackground(background.id), setNotice)} removeDisabled={background.id === state.fr3.activeBackgroundId && state.fr3.enabled} />)}
            </div>
          </section>
          <details className="panel transform-panel fr3-transform-panel">
            <summary className="adjustment-summary">{t('viewer.fr3.adjustments', { defaultValue: 'Ajustări imagine FR3' })}</summary>
            <Range label={t('viewer.brightness', { defaultValue: 'Luminozitate' })} value={state.fr3.transform.brightness} min={0} max={200} unit="%" onChange={brightness => updateFr3({ brightness })} />
            <Range label={t('viewer.contrast', { defaultValue: 'Contrast' })} value={state.fr3.transform.contrast} min={0} max={200} unit="%" onChange={contrast => updateFr3({ contrast })} />
            <Range label={t('viewer.saturation', { defaultValue: 'Saturație' })} value={state.fr3.transform.saturation} min={0} max={200} unit="%" onChange={saturation => updateFr3({ saturation })} />
            <Range label={t('viewer.zoom', { defaultValue: 'Zoom' })} value={state.fr3.transform.zoom} min={1} max={4} step={0.01} unit="×" onChange={zoom => updateFr3({ zoom })} />
            <Range label={t('viewer.positionX', { defaultValue: 'Poziție X' })} value={state.fr3.transform.panX} min={-maxViewerPanForZoom(state.fr3.transform.zoom)} max={maxViewerPanForZoom(state.fr3.transform.zoom)} unit="%" onChange={panX => updateFr3({ panX })} />
            <Range label={t('viewer.positionY', { defaultValue: 'Poziție Y' })} value={state.fr3.transform.panY} min={-maxViewerPanForZoom(state.fr3.transform.zoom)} max={maxViewerPanForZoom(state.fr3.transform.zoom)} unit="%" onChange={panY => updateFr3({ panY })} />
            <Toggle label={t('viewer.flipHorizontal', { defaultValue: 'Flip orizontal' })} checked={state.fr3.transform.flipX} onChange={flipX => updateFr3({ flipX })} />
            <button className="reset" onClick={() => void runAction(window.viewerApi.resetFr3Transform(), setNotice)}>{t('viewer.resetAdjustments', { defaultValue: 'Resetează ajustările' })}</button>
          </details>
        </article>
      </section>
      {(notice || state.error) && <div className="error" role="status">{notice ?? state.error}</div>}
    </main>
  )
}

function BackgroundTile({ background, selected, applied, onSelect, onRemove, removeDisabled }: { background: ViewerState['backgrounds'][number]; selected: boolean; applied: boolean; onSelect: () => void; onRemove: () => void; removeDisabled: boolean }) {
  const { t } = useTranslation()
  return <div className={`background-tile ${selected ? 'selected' : ''}`}>
    <div className="background-select-wrap">
      <button type="button" className="background-select" disabled={!background.available} onClick={onSelect} aria-label={t('viewer.fr3.selectBackground', { name: background.name, defaultValue: `Select ${background.name} for preview` })} aria-pressed={selected}>
        <span className="background-thumbnail">{background.available ? <img src={background.url} alt="" /> : <span aria-hidden="true">{t('viewer.fr3.unavailable', { defaultValue: 'Lipsă' })}</span>}</span>
        <span className="background-name">{background.name}</span>
        <span className="background-badges">{selected && <i>{t('viewer.fr3.selected', { defaultValue: 'Selectat' })}</i>}{applied && <i className="live-badge">{t('viewer.fr3.applied', { defaultValue: 'LIVE' })}</i>}</span>
      </button>
      <button type="button" className="tile-remove" disabled={removeDisabled} title={removeDisabled ? t('viewer.fr3.liveCannotRemove', { defaultValue: 'Ascunde FR3 înainte de a elimina imaginea activă.' }) : t('viewer.fr3.remove', { defaultValue: 'Elimină din galerie' })} aria-label={t('viewer.fr3.remove', { defaultValue: 'Elimină din galerie' })} onClick={onRemove}>×</button>
    </div>
  </div>
}

type DisplayedActiveImage = { image: NonNullable<ViewerState['activeImage']>; transform: ViewerTransform }

function useActiveImageLayers(activeImage: ViewerState['activeImage'], transform: ViewerTransform) {
  const [layers, setLayers] = useState<{ current: DisplayedActiveImage | null; previous: DisplayedActiveImage | null }>({ current: null, previous: null })
  const cleanupFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!activeImage) return
    setLayers(current => {
      const layer = current.current
      if (!layer || layer.image.url !== activeImage.url || sameTransform(layer.transform, transform)) return current
      return { ...current, current: { ...layer, transform } }
    })
  }, [activeImage?.url, transform.brightness, transform.contrast, transform.saturation, transform.zoom, transform.panX, transform.panY, transform.flipX])

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
  const { t } = useTranslation()
  const applied = state.backgrounds.find(background => background.id === state.fr3.activeBackgroundId && background.available)
  const [displayed, setDisplayed] = useState<{ url: string; transform: ViewerTransform } | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!applied) setDisplayed(null)
  }, [applied?.url])

  return <main className="output" aria-label="Fereastră fundal FR3">
    {displayed && <img className="background-image previous-image" src={displayed.url} alt="" style={imageStyle(state.fr3.transform)} />}
    {applied && displayed?.url !== applied.url && <img className="background-image pending-image" src={applied.url} alt="" aria-hidden="true" style={imageStyle(state.fr3.transform)} onLoad={() => { setLoadError(false); setDisplayed({ url: applied.url, transform: state.fr3.transform }) }} onError={() => setLoadError(true)} />}
    {applied && displayed?.url === applied.url && <img className="background-image current-image" src={applied.url} alt="" style={imageStyle(state.fr3.transform)} />}
    {loadError && <span className="image-load-error" role="status">{t('viewer.fr3.imageLoadError', { defaultValue: 'Imaginea nu a putut fi încărcată.' })}</span>}
  </main>
}

function BackgroundImage({ selected, transform, onError }: { selected: ViewerState['backgrounds'][number]; transform: ViewerTransform; onError: () => void }) {
  const [displayed, setDisplayed] = useState<{ url: string; transform: ViewerTransform } | null>(null)
  useEffect(() => {
    if (!selected.available) setDisplayed(null)
  }, [selected.url, selected.available])
  return <>
    {displayed && <img className="background-image previous-image" src={displayed.url} alt="" style={imageStyle(transform)} />}
    {selected.available && displayed?.url !== selected.url && <img className="background-image pending-image" src={selected.url} alt="" aria-hidden="true" style={imageStyle(transform)} onLoad={() => setDisplayed({ url: selected.url, transform })} onError={onError} />}
    {selected.available && displayed?.url === selected.url && <img className="background-image current-image" src={selected.url} alt={selected.name} style={imageStyle(transform)} />}
  </>
}

function Settings({ state, hidden, page, onNavigate }: { state: ViewerState; hidden: boolean; page: 'control' | 'settings'; onNavigate: (page: 'control' | 'settings') => void }) {
  const { t } = useTranslation()
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
      <section className="panel shared-display-settings" aria-labelledby="shared-output-settings-heading">
        <h2 id="shared-output-settings-heading">{t('viewer.shared.settingsTitle', { defaultValue: 'Monitor și ordinea ferestrelor' })}</h2>
        <label className="display-selector">{t('viewer.shared.display', { defaultValue: 'Monitor FR2 și FR3' })}<select aria-label={t('viewer.shared.display', { defaultValue: 'Monitor FR2 și FR3' })} value={state.window.displayId ?? ''} onChange={event => void runAction(window.viewerApi.setWindow({ displayId: event.target.value }), setNotice)}>
          {state.displays.map(display => <option key={display.id} value={display.id}>{display.label}{display.primary ? ` — ${t('viewer.primaryDisplay', { defaultValue: 'principal' })}` : ''}</option>)}
        </select></label>
        <p className="hint">{t('viewer.shared.orderHint', { defaultValue: 'Valori z-index între 0 și 100. Valoarea mai mare apare deasupra; la egalitate, FR2 rămâne deasupra.' })}</p>
        <div className="output-order-fields">
          <NumberField label={t('viewer.shared.fr2Order', { defaultValue: 'FR2 — z-index' })} value={state.outputOrder.fr2} min={0} max={100} onChange={fr2 => void runAction(window.viewerApi.setOutputOrder({ ...state.outputOrder, fr2 }), setNotice)} />
          <NumberField label={t('viewer.shared.fr3Order', { defaultValue: 'FR3 — z-index' })} value={state.outputOrder.fr3} min={0} max={100} onChange={fr3 => void runAction(window.viewerApi.setOutputOrder({ ...state.outputOrder, fr3 }), setNotice)} />
        </div>
      </section>
      <section className="panel settings-panel">
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

function FullscreenIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" /></svg>
}

function WindowedIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const next = Number(draft)
    if (!Number.isFinite(next) || (min !== undefined && next < min) || (max !== undefined && next > max)) return setDraft(String(value))
    onChange(Math.round(next))
  }
  return <label className="number-field"><span>{label}</span><input type="number" value={draft} min={min} max={max} step="1" onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
}

function updateWindowBounds(state: ViewerState, patch: Partial<NonNullable<ViewerState['window']['bounds']>>, setNotice: (notice: string | null) => void) {
  const bounds = { x: 0, y: 0, width: 1280, height: 720, ...state.window.bounds, ...patch }
  const boundsChangedDimension = Object.hasOwn(patch, 'height') ? 'height' : 'width'
  void runAction(window.viewerApi.setWindow({ bounds, boundsChangedDimension }), setNotice)
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

function sameTransform(left: ViewerTransform, right: ViewerTransform) {
  return left.brightness === right.brightness && left.contrast === right.contrast && left.saturation === right.saturation && left.zoom === right.zoom && left.panX === right.panX && left.panY === right.panY && left.flipX === right.flipX
}

function runAction<T>(action: Promise<T>, setNotice: (notice: string | null) => void) {
  setNotice(null)
  return action.then(() => undefined).catch(error => {
    setNotice(error instanceof Error ? error.message : 'Acțiunea nu a putut fi finalizată.')
  })
}

export default App
