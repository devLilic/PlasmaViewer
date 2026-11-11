import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getViewerKeyboardAdjustment, maxViewerPanForZoom, type ViewerBackground, type ViewerState, type ViewerTransform, type ViewerTransformDefaults } from '@/shared/viewer/contracts'
import { isAutoUpdateEnabled } from '@/shared/auto-update/activation'
import UpdateFeature from '@/features/update'
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
  const { t } = useTranslation()
  return <nav className="viewer-navigation" aria-label="Navigare Viewer"><button className={page === 'settings' ? 'active' : ''} onClick={() => onChange('settings')}><UiIcon name="settings" /> {t('viewer.navigation.settings', { defaultValue: 'Setări' })}</button><span className="navigation-divider" aria-hidden="true" /><button className={page === 'control' ? 'active' : ''} onClick={() => onChange('control')}><UiIcon name="play" /> Control</button></nav>
}


function UiIcon({ name }: { name: 'settings' | 'play' | 'stop' | 'hide' | 'plus' }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
    {name === 'play' && <path d="M8 4v16l12-8z" fill="currentColor" stroke="none" />}
    {name === 'stop' && <rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" stroke="none" />}
    {name === 'plus' && <path d="M12 4v16M4 12h16" />}
    {name === 'hide' && <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.3 5.3A11 11 0 0 1 12 5c5 0 8.5 4.3 9.5 7a12 12 0 0 1-3 4.2M6.2 6.3A12 12 0 0 0 2.5 12c1 2.7 4.5 7 9.5 7 1.1 0 2.2-.2 3.1-.6" /></>}
    {name === 'settings' && <><path d="M10 2h4l.6 2.5 2 .9 2.2-1.3 2.8 2.8-1.3 2.2.9 2L23 12v3l-2.3.6-.9 2 1.3 2.2-2.8 2.8-2.2-1.3-2 .9L14 24h-4l-.6-2.3-2-.9-2.2 1.3-2.8-2.8 1.3-2.2-.9-2L1 14v-3l2.3-.6.9-2-1.3-2.2 2.8-2.8 2.2 1.3 2-.9z" transform="translate(0 -1) scale(.92)" /><circle cx="11" cy="11" r="3" /></>}
  </svg>
}

function Output({ state }: { state: ViewerState }) {
  return (
    <main className="output" aria-label="Fereastra Plasme">
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
  const [target, setTarget] = useState<'plasme' | 'background'>('background')
  const [inspectorTab, setInspectorTab] = useState<'source' | 'aspect' | 'settings'>('source')
  const updateTransform = (patch: Partial<ViewerTransform>) => runAction(window.viewerApi.setTransform({ ...state.transform, ...patch }), setNotice)
  const updateFr3 = (patch: Partial<ViewerTransform>) => runAction(window.viewerApi.setFr3({ transform: { ...state.fr3.transform, ...patch } }), setNotice)
  const canDisplay = Boolean(state.activeImage)
  const outputsLive = state.visible || state.fr3.visible
  const selectedBackground = state.backgrounds.find(background => background.id === state.fr3.selectedBackgroundId) ?? null
  const [readyVideoUrl, setReadyVideoUrl] = useState<string | null>(null)
  const canShowFr3 = selectedBackground?.available && (selectedBackground.kind !== 'video' || selectedBackground.url === readyVideoUrl)
  const [keyboardAdjustEnabled, setKeyboardAdjustEnabled] = useState(false)
  const keyboardModeButtonRef = useRef<HTMLButtonElement>(null)
  const keyboardDialogCloseRef = useRef<HTMLButtonElement>(null)

  const closeKeyboardAdjust = useCallback(() => {
    setKeyboardAdjustEnabled(false)
    requestAnimationFrame(() => keyboardModeButtonRef.current?.focus())
  }, [])

  useEffect(() => {
    if (hidden || state.window.fullscreen || target !== 'plasme' || inspectorTab !== 'settings') setKeyboardAdjustEnabled(false)
  }, [hidden, state.window.fullscreen, target, inspectorTab])

  useEffect(() => {
    if (!keyboardAdjustEnabled || hidden || state.window.fullscreen) return
    keyboardDialogCloseRef.current?.focus()
    const onBlur = () => setKeyboardAdjustEnabled(false)
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const adjustment = getViewerKeyboardAdjustment(event)
      if (!adjustment) return
      event.preventDefault()
      if (adjustment.type === 'disable') return closeKeyboardAdjust()
      const current = state.window.bounds ?? { x: 0, y: 0, width: 1280, height: 720 }
      if (adjustment.type === 'resize') {
        const width = Math.max(320, current.width + adjustment.direction * adjustment.step)
        const scale = width / current.width
        const bounds = { ...current, width, height: Math.max(180, Math.round(current.height * scale)) }
        void runAction(window.viewerApi.setWindow({ bounds, boundsChangedDimension: 'width' }), setNotice)
        return
      }
      const bounds = addBoundsPatch(current, adjustment.patch)
      void runAction(window.viewerApi.setWindow({ bounds, boundsChangedDimension: adjustment.boundsChangedDimension }), setNotice)
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [keyboardAdjustEnabled, hidden, state.window.bounds, state.window.fullscreen, closeKeyboardAdjust])

  const toggleKeyboardAdjust = (enabled: boolean) => {
    setKeyboardAdjustEnabled(enabled)
  }

  return (
    <main className="control-shell" hidden={hidden}>
      <header className="topbar">
        <Navigation page={page} onChange={onNavigate} />
        <div className="header-actions">
          <button className={`onair-control ${outputsLive ? 'live' : ''}`} disabled={!outputsLive} onClick={() => void runAction(window.viewerApi.disconnectOutputs(), setNotice)} aria-label="Deconectează ferestrele Plasme și Background"><UiIcon name="stop" /><span>{t('viewer.stopOutputs', { defaultValue: 'Oprește toate ieșirile' })}</span></button>
        </div>
      </header>

      <section className="workspace" aria-label={t('viewer.columns', { defaultValue: 'Previzualizări Plasme și Background' })}>
        <article className="output-column fr2-column" aria-labelledby="fr2-heading">
          <div className={`preview-card ${target === 'plasme' ? 'selected-output' : ''}`}>
            <div className="preview-card-heading">
              <h1 id="fr2-heading" className="column-title"><button type="button" className="output-select" aria-pressed={target === 'plasme'} onClick={() => setTarget('plasme')}>Plasme</button></h1><span className={`output-status ${state.visible ? 'is-live' : 'is-off'}`}>{state.visible ? 'ON AIR' : 'OFF AIR'}</span>
            </div>
            <div className="preview"><ImageLayers state={state} preview /></div>
            <div className="preview-meta">
              <div><strong>{state.activeImage?.title ?? 'Fără imagine'}</strong>{!state.activeImage && <small>Apasă onAIR în playlist</small>}{state.activeImage && <small className="image-source">Sursă locală: {state.activeImage.source ?? 'Fișier local indisponibil'}</small>}</div>
              <div className="actions">
                <button className="secondary" disabled={!state.visible} onClick={() => void runAction(window.viewerApi.hideOutput(), setNotice)}><UiIcon name="hide" /> Ascunde</button>
                <button className="primary" disabled={!canDisplay} onClick={() => void runAction(window.viewerApi.showOutput(), setNotice)}><UiIcon name="play" /> Afișează</button>
              </div>
            </div>
          </div>
        </article>

        <article className="output-column fr3-column" aria-labelledby="fr3-heading">
          <div className={`preview-card ${target === 'background' ? 'selected-output' : ''}`}>
            <div className="preview-card-heading"><h1 id="fr3-heading" className="column-title"><button type="button" className="output-select" aria-pressed={target === 'background'} onClick={() => setTarget('background')}>Background</button></h1><span className={`output-status ${state.fr3.visible ? 'is-live' : ''}`}>{state.fr3.visible ? 'ON AIR' : 'PREVIZUALIZARE'}</span></div>
            <div className="preview fr3-preview" aria-label={t('viewer.fr3.preview', { defaultValue: 'Previzualizare Background' })}>
              {selectedBackground?.available ? <BackgroundLayers background={selectedBackground} transform={state.fr3.transform} playing={!hidden} onVideoReady={setReadyVideoUrl} /> : <div className="empty">{t('viewer.fr3.noSelection', { defaultValue: 'Selectează un fundal din galerie' })}</div>}

            </div>
            <div className="preview-meta fr3-preview-meta">
              <div><strong>{selectedBackground?.name ?? t('viewer.fr3.noSelection', { defaultValue: 'Selectează un fundal din galerie' })}</strong><small>{state.fr3.visible ? t('viewer.fr3.visible', { defaultValue: 'Background este afișat' }) : t('viewer.fr3.hidden', { defaultValue: 'Background este ascuns' })}</small></div>
              <div className="actions"><button className="secondary" disabled={!state.fr3.enabled} onClick={() => void runAction(window.viewerApi.hideFr3(), setNotice)}><UiIcon name="hide" /> {t('viewer.hide', { defaultValue: 'Ascunde' })}</button><button className="primary" disabled={!canShowFr3} onClick={() => void runAction(window.viewerApi.showFr3(), setNotice)}><UiIcon name="play" /> {t('viewer.show', { defaultValue: 'Afișează' })}</button></div>
            </div>
          </div>
        </article>
      </section>
      <section className="inspector" aria-label={t('viewer.inspector.label', { defaultValue: 'Configurare ieșire' })}>
        <div className="inspector-target" role="group" aria-label={t('viewer.inspector.target', { defaultValue: 'Ieșire selectată' })}>
          <span>{t('viewer.inspector.targetLabel', { defaultValue: 'Țintă' })}:</span>
          <div className="target-segment"><button type="button" className={target === 'plasme' ? 'active' : ''} aria-pressed={target === 'plasme'} onClick={() => setTarget('plasme')}>Plasme</button>
          <button type="button" className={target === 'background' ? 'active' : ''} aria-pressed={target === 'background'} onClick={() => setTarget('background')}>Background</button></div>
        </div>
        <div className="inspector-tabs" role="tablist" aria-label={t('viewer.inspector.tabs', { defaultValue: 'Configurare' })}>
          {(['source', 'aspect', 'settings'] as const).map(tab => <button key={tab} type="button" role="tab" aria-selected={inspectorTab === tab} className={inspectorTab === tab ? 'active' : ''} onClick={() => setInspectorTab(tab)}>{t(`viewer.inspector.${tab}`, { defaultValue: tab === 'source' ? 'Sursă' : tab === 'aspect' ? 'Aspect' : 'Setări' })}</button>)}
        </div>
        <div className="inspector-content">
          <div hidden={inspectorTab !== 'source' || target !== 'background'}>
          <section className="gallery-card" aria-label={t('viewer.fr3.gallery', { defaultValue: 'Galerie locală Background' })}>
            <div className="gallery-heading"><div><h2>{t('viewer.fr3.gallery', { defaultValue: 'Galerie locală Background' })}</h2><p>{t('viewer.fr3.galleryHint', { defaultValue: 'Selectarea schimbă doar previzualizarea.' })}</p></div><button className="primary import-button" onClick={() => void runAction(window.viewerApi.importBackgrounds(), setNotice)}><UiIcon name="plus" /> {t('viewer.fr3.addFiles', { defaultValue: 'Adaugă fișiere' })}</button></div>
            <div className="background-gallery">
              {state.backgrounds.length === 0 && <p className="gallery-empty">{t('viewer.fr3.emptyGallery', { defaultValue: 'Adaugă imagini sau clipuri MP4 pentru Background.' })}</p>}
              {state.backgrounds.map(background => <BackgroundTile key={background.id} background={background} selected={background.id === state.fr3.selectedBackgroundId} applied={background.id === state.fr3.activeBackgroundId} onSelect={() => void runAction(window.viewerApi.selectBackground(background.id), setNotice)} onRemove={() => void runAction(window.viewerApi.removeBackground(background.id), setNotice)} removeDisabled={background.id === state.fr3.activeBackgroundId && state.fr3.enabled} />)}
            </div>
          </section>

          </div>
          <div hidden={inspectorTab !== 'source' || target !== 'plasme'} className="source-info">
            <h2>{t('viewer.inspector.plasmeSource', { defaultValue: 'Sursă Plasme' })}</h2>
            <p>{state.activeImage?.title ?? t('viewer.fr2.empty', { defaultValue: 'Nicio imagine selectată din Plasma' })}</p>
            {state.activeImage?.source && <p>{state.activeImage.source}</p>}
          </div>
          <div hidden={inspectorTab !== 'aspect' || target !== 'plasme'}>          <div className="panel transform-panel">
            <h2>Ajustări Plasme</h2>
            <Range label="Luminozitate" value={state.transform.brightness} min={0} max={200} unit="%" onChange={brightness => updateTransform({ brightness })} />
            <Range label="Contrast" value={state.transform.contrast} min={0} max={200} unit="%" onChange={contrast => updateTransform({ contrast })} />
            <Range label="Saturație" value={state.transform.saturation} min={0} max={200} unit="%" onChange={saturation => updateTransform({ saturation })} />
            <Range label="Zoom" value={state.transform.zoom} min={1} max={4} step={0.01} unit="×" onChange={zoom => updateTransform({ zoom })} />
            <Range label="Poziție X" value={state.transform.panX} min={-maxViewerPanForZoom(state.transform.zoom)} max={maxViewerPanForZoom(state.transform.zoom)} unit="%" onChange={panX => updateTransform({ panX })} />
            <Range label="Poziție Y" value={state.transform.panY} min={-maxViewerPanForZoom(state.transform.zoom)} max={maxViewerPanForZoom(state.transform.zoom)} unit="%" onChange={panY => updateTransform({ panY })} />
            <Toggle label="Flip orizontal" checked={state.transform.flipX} onChange={flipX => updateTransform({ flipX })} />
            <button className="reset" onClick={() => void runAction(window.viewerApi.resetTransform(), setNotice)}>Resetează ajustările</button>
          </div>
</div>
          <div hidden={inspectorTab !== 'aspect' || target !== 'background'}>          <div className="panel transform-panel fr3-transform-panel">
            <h2>{t('viewer.fr3.adjustments', { defaultValue: 'Ajustări Background' })}</h2>
            <Range label={t('viewer.brightness', { defaultValue: 'Luminozitate' })} value={state.fr3.transform.brightness} min={0} max={200} unit="%" onChange={brightness => updateFr3({ brightness })} />
            <Range label={t('viewer.contrast', { defaultValue: 'Contrast' })} value={state.fr3.transform.contrast} min={0} max={200} unit="%" onChange={contrast => updateFr3({ contrast })} />
            <Range label={t('viewer.saturation', { defaultValue: 'Saturație' })} value={state.fr3.transform.saturation} min={0} max={200} unit="%" onChange={saturation => updateFr3({ saturation })} />
            <Range label={t('viewer.zoom', { defaultValue: 'Zoom' })} value={state.fr3.transform.zoom} min={1} max={4} step={0.01} unit="×" onChange={zoom => updateFr3({ zoom })} />
            <Range label={t('viewer.positionX', { defaultValue: 'Poziție X' })} value={state.fr3.transform.panX} min={-maxViewerPanForZoom(state.fr3.transform.zoom)} max={maxViewerPanForZoom(state.fr3.transform.zoom)} unit="%" onChange={panX => updateFr3({ panX })} />
            <Range label={t('viewer.positionY', { defaultValue: 'Poziție Y' })} value={state.fr3.transform.panY} min={-maxViewerPanForZoom(state.fr3.transform.zoom)} max={maxViewerPanForZoom(state.fr3.transform.zoom)} unit="%" onChange={panY => updateFr3({ panY })} />
            <Toggle label={t('viewer.flipHorizontal', { defaultValue: 'Flip orizontal' })} checked={state.fr3.transform.flipX} onChange={flipX => updateFr3({ flipX })} />
            <button className="reset" onClick={() => void runAction(window.viewerApi.resetFr3Transform(), setNotice)}>{t('viewer.resetAdjustments', { defaultValue: 'Resetează ajustările' })}</button>
          </div>
</div>
          <div hidden={inspectorTab !== 'settings' || target !== 'plasme'}>
            <div className="inspector-mode"><h2>{t('viewer.inspector.displayMode', { defaultValue: 'Mod afișare' })}</h2>              <div className="window-mode-actions" role="group" aria-label="Mod afișare Plasme">
                <button type="button" className={`window-mode-button ${state.window.fullscreen ? 'active' : ''}`} aria-label="Afișează ieșirea Plasme pe tot ecranul" title="Plasme pe tot ecranul" onClick={() => void runAction(window.viewerApi.setWindow({ fullscreen: true }), setNotice)}><FullscreenIcon /></button>
                <button type="button" className={`window-mode-button ${!state.window.fullscreen ? 'active' : ''}`} aria-label="Afișează ieșirea Plasme în fereastră" title="Plasme în fereastră" onClick={() => void runAction(window.viewerApi.setWindow({ fullscreen: false }), setNotice)}><WindowedIcon /></button>
              </div>
</div>
          <section className="geometry-card">
            <div className="section-heading"><div><h2>Poziție și dimensiune Plasme</h2><p>Se aplică în modul windowed.</p></div><span className="geometry-mode">{state.window.aspectMode === '16:9' ? '16:9 blocat' : 'liber'}</span></div>
            <div className="window-bounds">
              <NumberField label="Stânga" value={state.window.bounds?.x ?? 0} onChange={x => updateWindowBounds(state, { x }, setNotice)} />
              <NumberField label="Sus" value={state.window.bounds?.y ?? 0} onChange={y => updateWindowBounds(state, { y }, setNotice)} />
              <NumberField label="Lățime" value={state.window.bounds?.width ?? 1280} min={320} onChange={width => updateWindowBounds(state, { width }, setNotice)} />
              <NumberField label="Înălțime" value={state.window.bounds?.height ?? 720} min={180} onChange={height => updateWindowBounds(state, { height }, setNotice)} />
            </div>
            <div className="keyboard-adjustment" aria-label={t('viewer.fr2.keyboardTitle', { defaultValue: 'Ajustare Plasme din taste' })}>
              <button ref={keyboardModeButtonRef} type="button" className={`keyboard-mode ${keyboardAdjustEnabled ? 'active' : ''}`} disabled={state.window.fullscreen} onClick={() => toggleKeyboardAdjust(!keyboardAdjustEnabled)}><span>{t('viewer.fr2.keyboardTitle', { defaultValue: 'Ajustare Plasme din taste' })}</span><b>{keyboardAdjustEnabled ? 'ON' : 'OFF'}</b></button>
            </div>
          </section>

          <section className="geometry-card window-settings-card" aria-label="Setări fereastră Plasme">
            <div className="window-settings-heading"><h2>{t('viewer.fr2.windowSettings', { defaultValue: 'Fereastră Plasme' })}</h2></div>
            <Toggle label="Întotdeauna deasupra" checked={state.window.topmost} onChange={checked => void runAction(window.viewerApi.setWindow({ topmost: checked }), setNotice)} />
            <Toggle label="Fixează 16:9" checked={state.window.aspectMode === '16:9'} onChange={checked => void runAction(window.viewerApi.setWindow({ aspectMode: checked ? '16:9' : 'free' }), setNotice)} />
          </section>

          </div>
          <div hidden={inspectorTab !== 'settings' || target !== 'background'} className="source-info">
            <h2>{t('viewer.inspector.displayMode', { defaultValue: 'Mod afișare' })}</h2>
            <p>{t('viewer.inspector.backgroundFullscreen', { defaultValue: 'Background este afișat pe tot ecranul.' })}</p>
          </div>
        </div>
      </section>
      {(notice || state.error) && <div className="error" role="status">{notice ?? state.error}</div>}
      {keyboardAdjustEnabled && !hidden && !state.window.fullscreen && <KeyboardAdjustmentDialog closeButtonRef={keyboardDialogCloseRef} onClose={closeKeyboardAdjust} />}
    </main>
  )
}

function KeyboardAdjustmentDialog({ closeButtonRef, onClose }: { closeButtonRef: { current: HTMLButtonElement | null }; onClose: () => void }) {
  const { t } = useTranslation()
  const text = (key: string, fallback: string) => t(`viewer.fr2.keyboardDialog.${key}`, { defaultValue: fallback })

  return (
    <div className="keyboard-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="keyboard-dialog" role="dialog" aria-modal="true" aria-labelledby="keyboard-dialog-title" aria-describedby="keyboard-dialog-subtitle">
        <header className="keyboard-dialog-header">
          <div className="keyboard-dialog-heading">
            <span className="keyboard-dialog-mark" aria-hidden="true">⌖</span>
            <div><h2 id="keyboard-dialog-title">{text('title', 'Ajustare Plasme din taste')}</h2><p id="keyboard-dialog-subtitle">{text('subtitle', 'Mod fereastră · Închide această fereastră pentru a opri modul')}</p></div>
          </div>
          <button ref={closeButtonRef} type="button" className="keyboard-dialog-close" onClick={onClose} aria-label={text('close', 'Închide și oprește ajustarea')}>×</button>
        </header>
        <div className="keyboard-dialog-cards">
          <article className="keyboard-instruction-card">
            <h3>{text('moveTitle', 'Mută fereastra')}</h3>
            <ArrowKeyCluster />
            <p className="keyboard-instruction-caption">{text('moveStep', 'Mută cu 10 px')}</p>
          </article>
          <article className="keyboard-instruction-card keyboard-resize-card">
            <h3>{text('resizeTitle', 'Redimensionează')}</h3>
            <div className="keyboard-resize-row"><kbd>+</kbd><span>{text('enlarge', 'Mărește fereastra')}</span></div>
            <div className="keyboard-resize-row"><kbd>−</kbd><span>{text('shrink', 'Micșorează fereastra')}</span></div>
          </article>
        </div>
        <div className="keyboard-shift-note"><kbd>Shift</kbd><span>{text('shiftStep', 'Ține apăsat Shift pentru pas de 50 px la toate comenzile')}</span></div>
        <footer className="keyboard-dialog-footer">
          <div className="keyboard-close-hint"><kbd>Esc</kbd><span>{text('escape', 'Esc oprește ajustarea; butonul de închidere face același lucru.')}</span></div>
          <span className="keyboard-active-status"><i aria-hidden="true" />{text('active', 'ACTIV')}</span>
        </footer>
      </section>
    </div>
  )
}

function ArrowKeyCluster() {
  return <div className="keyboard-arrow-cluster" aria-hidden="true">
    <kbd className="arrow-up">↑</kbd><kbd className="arrow-left">←</kbd><kbd className="arrow-down">↓</kbd><kbd className="arrow-right">→</kbd>
  </div>
}

function BackgroundTile({ background, selected, applied, onSelect, onRemove, removeDisabled }: { background: ViewerState['backgrounds'][number]; selected: boolean; applied: boolean; onSelect: () => void; onRemove: () => void; removeDisabled: boolean }) {
  const { t } = useTranslation()
  const name = background.kind === 'video' ? `${background.name} (MP4)` : background.name
  return <div className={`background-tile ${selected ? 'selected' : ''}`}>
    <div className="background-select-wrap">
      <button type="button" className="background-select" disabled={!background.available} onClick={onSelect} aria-label={t('viewer.fr3.selectBackground', { name, defaultValue: `Select ${name} for preview` })} aria-pressed={selected}>
        <span className="background-thumbnail">{!background.available ? <span aria-hidden="true">{t('viewer.fr3.unavailable', { defaultValue: 'Lipsă' })}</span>
          : background.kind === 'video' ? <VideoThumbnail url={background.url} />
          : <img src={background.url} alt="" />}</span>
        <span className="background-name">{background.name}</span>
        <span className="background-badges">{selected && <i>{t('viewer.fr3.selected', { defaultValue: 'Selectat' })}</i>}{applied && <i className="live-badge">{t('viewer.fr3.applied', { defaultValue: 'LIVE' })}</i>}</span>
      </button>
      <button type="button" className="tile-remove" disabled={removeDisabled} title={removeDisabled ? t('viewer.fr3.liveCannotRemove', { defaultValue: 'Ascunde Background înainte de a elimina fundalul activ.' }) : t('viewer.fr3.remove', { defaultValue: 'Elimină din galerie' })} aria-label={t('viewer.fr3.remove', { defaultValue: 'Elimină din galerie' })} onClick={onRemove}>×</button>
    </div>
  </div>
}

function VideoThumbnail({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [url])

  return <>
    {!failed && <video
      className="video-thumbnail-frame"
      src={url}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      onLoadedMetadata={event => {
        const video = event.currentTarget
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = Math.min(1, video.duration / 2)
        }
      }}
      onError={() => setFailed(true)}
    />}
    <span className="video-thumbnail" aria-hidden="true">▶ MP4</span>
  </>
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
  const applied = state.backgrounds.find(background => background.id === state.fr3.activeBackgroundId && background.available)
  return <main className="output" aria-label="Fereastra Background">
    {state.fr3.visible && applied && <BackgroundLayers background={applied} transform={state.fr3.transform} playing />}
  </main>
}

function BackgroundLayers({ background, transform, playing, onVideoReady }: {
  background: ViewerBackground
  transform: ViewerTransform
  playing: boolean
  onVideoReady?: (url: string | null) => void
}) {
  const { t } = useTranslation()
  const [displayed, setDisplayed] = useState<ViewerBackground | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const readyVideo = displayed?.url === background.url && background.kind === 'video' && failedUrl !== background.url ? background.url : null
  useEffect(() => {
    onVideoReady?.(readyVideo)
    return () => onVideoReady?.(null)
  }, [onVideoReady, readyVideo])
  const layers = displayed && displayed.url !== background.url ? [displayed, background] : [background]
  return <>
    {layers.map(layer => {
      const current = displayed?.url === layer.url
      const className = `background-image ${current ? 'current-image' : 'pending-image'}`
      const onReady = () => {
        if (layer.url !== background.url) return
        setDisplayed(layer)
        setFailedUrl(null)
      }
      const onError = () => {
        if (layer.url !== background.url) return
        setFailedUrl(layer.url)
      }
      return layer.kind === 'video'
        ? <BackgroundVideo key={layer.url} src={layer.url} className={className} transform={transform} playing={playing && current} onReady={onReady} onError={onError} />
        : <img key={layer.url} className={className} src={layer.url} alt={current ? layer.name : ''} style={imageStyle(transform)} onLoad={onReady} onError={onError} />
    })}
    {failedUrl === background.url && <span className="image-load-error" role="status">{background.kind === 'video'
      ? t('viewer.fr3.videoLoadError', { defaultValue: 'Clipul MP4 nu poate fi redat.' })
      : t('viewer.fr3.imageLoadError', { defaultValue: 'Imaginea nu a putut fi încărcată.' })}</span>}
  </>
}

function BackgroundVideo({ src, className, transform, playing, onReady, onError }: {
  src: string
  className: string
  transform: ViewerTransform
  playing: boolean
  onReady: () => void
  onError: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (playing) void video.play().catch(() => undefined)
    else video.pause()
  }, [playing])

  return <video ref={ref} className={className} src={src} style={imageStyle(transform)} muted loop playsInline preload="auto"
    aria-hidden="true" onLoadedData={event => event.currentTarget.videoWidth > 0 ? onReady() : onError()} onError={onError} />
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
    <header className="topbar"><Navigation page={page} onChange={onNavigate} /><span className="settings-label">Settings</span></header>
    <section className="settings-layout">
      <section className="panel shared-display-settings" aria-labelledby="shared-output-settings-heading">
        <h2 id="shared-output-settings-heading">{t('viewer.shared.settingsTitle', { defaultValue: 'Monitor și ordinea ferestrelor' })}</h2>
        <label className="display-selector">{t('viewer.shared.display', { defaultValue: 'Monitor Plasme și Background' })}<select aria-label={t('viewer.shared.display', { defaultValue: 'Monitor Plasme și Background' })} value={state.window.displayId ?? ''} onChange={event => void runAction(window.viewerApi.setWindow({ displayId: event.target.value }), setNotice)}>
          {state.displays.map(display => <option key={display.id} value={display.id}>{display.label}{display.primary ? ` — ${t('viewer.primaryDisplay', { defaultValue: 'principal' })}` : ''}</option>)}
        </select></label>
        <p className="hint">{t('viewer.shared.orderHint', { defaultValue: 'Valori z-index între 0 și 100. Valoarea mai mare apare deasupra; la egalitate, Plasme rămâne deasupra.' })}</p>
        <div className="output-order-fields">
          <NumberField label={t('viewer.shared.fr2Order', { defaultValue: 'Plasme — z-index' })} value={state.outputOrder.fr2} min={0} max={100} onChange={fr2 => void runAction(window.viewerApi.setOutputOrder({ ...state.outputOrder, fr2 }), setNotice)} />
          <NumberField label={t('viewer.shared.fr3Order', { defaultValue: 'Background — z-index' })} value={state.outputOrder.fr3} min={0} max={100} onChange={fr3 => void runAction(window.viewerApi.setOutputOrder({ ...state.outputOrder, fr3 }), setNotice)} />
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>Defaulturi Plasme pentru imagini onAIR</h2>
        <p className="hint">Se aplică la resetare și pentru inițializările următoare; nu modifică imaginea onAIR curentă.</p>
        <Range label="Luminozitate" value={draft.brightness} min={0} max={200} unit="%" onChange={brightness => setDraft(current => ({ ...current, brightness }))} />
        <Range label="Contrast" value={draft.contrast} min={0} max={200} unit="%" onChange={contrast => setDraft(current => ({ ...current, contrast }))} />
        <Range label="Saturație" value={draft.saturation} min={0} max={200} unit="%" onChange={saturation => setDraft(current => ({ ...current, saturation }))} />
        {!valid && <p className="validation-error">Valorile trebuie să fie între 0% și 200%.</p>}
        {changed && <p className="unsaved">Modificări nesalvate.</p>}
        <button className="primary save-defaults" disabled={!valid || !changed || saving} onClick={() => void save()}>{saving ? 'Se salvează…' : 'Salvează'}</button>
        {notice && <p className="settings-notice">{notice}</p>}
      </section>
      {isAutoUpdateEnabled(window.appApi.getConfig()) && <section className="panel update-settings">
        <h2>{t('updater:title', { defaultValue: 'Actualizări' })}</h2>
        <p className="hint">{t('updater:description', { defaultValue: 'Verifică versiunile noi publicate pentru PlasmaVu.' })}</p>
        <UpdateFeature />
      </section>}
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
