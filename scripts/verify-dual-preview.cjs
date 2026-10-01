// Application-only smoke check: isolated userData and loopback port; no installed profile changes.
const { app, BrowserWindow, dialog, screen } = require('electron')
const { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync } = require('node:fs')
const path = require('node:path')
const { tmpdir } = require('node:os')
const { createServer } = require('node:http')

const restartProfile = process.argv.find(argument => argument.startsWith('--verify-restart-profile='))?.slice('--verify-restart-profile='.length)
if (restartProfile && (path.dirname(path.resolve(restartProfile)) !== path.resolve(tmpdir()) || !path.basename(restartProfile).startsWith('plasma-dual-preview-smoke-'))) throw new Error('Restart verification requires an isolated smoke-test profile')
const testProfile = restartProfile ? path.resolve(restartProfile) : mkdtempSync(path.join(tmpdir(), 'plasma-dual-preview-smoke-'))
app.setPath('userData', testProfile)
app.disableHardwareAcceleration()
const firstImage = path.join(testProfile, 'Telejurnal.png')
const secondImage = path.join(testProfile, 'Punctul pe Azi.png')
if (!restartProfile) {
  copyFileSync(path.resolve(__dirname, '../public/plasma-viewer-logo.png'), firstImage)
  copyFileSync(firstImage, secondImage)
  writeFileSync(path.join(testProfile, 'viewer-settings.json'), JSON.stringify({ defaultImagePath: firstImage,
    fr3: { enabled: false, transform: { brightness: 100, contrast: 100, saturation: 100 } } }))
}
process.env.PLASMA_VIEWER_PORT = '47839'
process.env.PLASMA_VIEWER_TOKEN = 'dual-preview-smoke-test'
process.env.APP_FEATURE_AUTO_UPDATE = 'false'
process.env.APP_UPDATE_ENABLED = 'false'
process.env.VITE_DEV_SERVER_URL = ''
const results = { profile: testProfile, checks: [], errors: [] }
const check = (condition, name) => { if (!condition) throw new Error(name); results.checks.push(name) }
const artifactDir = path.resolve(__dirname, '../release/dual-preview-test/verification')
mkdirSync(artifactDir, { recursive: true })
const resultsPath = path.join(artifactDir, restartProfile ? 'restart-results.json' : 'results.json')
const timeout = setTimeout(() => {
  results.errors.push('Application smoke verification timed out')
  writeFileSync(resultsPath, JSON.stringify(results, null, 2))
  app.exit(1)
}, 25000)

app.on('browser-window-created', (_event, window) => {
  window.on('show', () => window.hide())
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) results.errors.push(message) })
})

module.exports.verify = async () => {
  await app.whenReady()
  const imageServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'image/png' })
    response.end(readFileSync(firstImage))
  })
  await new Promise(resolve => imageServer.listen(0, '127.0.0.1', resolve))
  const imageUrl = `http://127.0.0.1:${imageServer.address().port}/onair.png`
  const command = async (type, payload) => {
    const response = await fetch('http://127.0.0.1:47839/v1/commands', {
      method: 'POST', headers: { Authorization: 'Bearer dual-preview-smoke-test', 'content-type': 'application/json' },
      body: JSON.stringify({ id: `smoke-${type}-${Date.now()}`, version: 1, timestamp: new Date().toISOString(), type, payload }),
    })
    if (!response.ok) throw new Error(`HTTP v1 ${type}: ${response.status}`)
    return response.json()
  }
  try {
    let control
    for (let attempt = 0; attempt < 100; attempt++) {
      control = BrowserWindow.getAllWindows().find(window => /view=control/.test(window.webContents.getURL()))
      if (control && !control.webContents.isLoading() && await control.webContents.executeJavaScript('Boolean(window.viewerApi && document.querySelector(".workspace"))')) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    check(Boolean(control), 'control window created')
    const originalEvaluate = code => control.webContents.executeJavaScript(code)
    const migrated = await originalEvaluate('window.viewerApi.getState()')
    if (restartProfile) {
      const expected = JSON.parse(readFileSync(path.join(testProfile, 'viewer-settings.expected-restart.json'), 'utf8'))
      check(migrated.backgrounds.length === expected.backgrounds.length && migrated.backgrounds.every(background => background.available && expected.backgrounds.some(item => item.id === background.id && item.name === background.name)), 'gallery images, identifiers and names survive a real application restart')
      check(migrated.fr3.selectedBackgroundId === expected.fr3.selectedBackgroundId && migrated.fr3.activeBackgroundId === expected.fr3.activeBackgroundId, 'selected and applied background identifiers survive restart')
      check(JSON.stringify(migrated.fr3.transform) === JSON.stringify(expected.fr3.transform), 'complete FR3 adjustments survive restart')
      check(migrated.window.displayId === migrated.fr3.displayId && JSON.stringify(migrated.outputOrder) === JSON.stringify(expected.outputOrder), 'common monitor and output order survive restart')
      check(await originalEvaluate(`document.querySelectorAll('.background-tile').length === ${expected.backgrounds.length}`), 'persisted gallery is restored in the renderer after restart')
      check(control.getTitle() === 'PlasmaVu' && await originalEvaluate(`document.querySelector('.brand').textContent.trim() === 'PlasmaVu'`), 'PlasmaVu branding appears in the header and native title without changing the saved profile')
      check(results.errors.length === 0, 'no renderer console errors after restart')
      writeFileSync(resultsPath, JSON.stringify(results, null, 2))
      console.log(JSON.stringify(results))
      clearTimeout(timeout)
      imageServer.close()
      app.quit()
      return
    }
    check(migrated.backgrounds.length === 1 && migrated.backgrounds[0].available && migrated.fr3.activeBackgroundId === migrated.backgrounds[0].id, 'legacy local image migrates with native image validation')
    check(migrated.window.displayId === migrated.fr3.displayId, 'FR2 and FR3 share the migrated display')
    check(migrated.outputOrder.fr2 === 3 && migrated.outputOrder.fr3 === 1, 'default output order places FR2 above FR3')
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: Array(9).fill(secondImage) })
    const imported = await originalEvaluate('window.viewerApi.importBackgrounds()')
    check(imported.backgrounds.length === 10 && imported.fr3.activeBackgroundId === migrated.fr3.activeBackgroundId && imported.fr3.selectedBackgroundId !== migrated.fr3.activeBackgroundId, 'real import selects preview without changing applied image')
    await originalEvaluate('window.viewerApi.showFr3()')
    await originalEvaluate(`window.viewerApi.renameBackground(${JSON.stringify(migrated.backgrounds[0].id)}, ${JSON.stringify('Telejurnal — ediția specială cu un nume foarte lung pentru verificarea încadrării în cardul galeriei și în previzualizare')})`)
    await originalEvaluate(`window.viewerApi.selectBackground(${JSON.stringify(migrated.backgrounds[0].id)})`)
    const split = await originalEvaluate('window.viewerApi.getState()')
    check(split.fr3.selectedBackgroundId !== split.fr3.activeBackgroundId && split.fr3.enabled, 'preview and live selection stay separate through real IPC')
    await command('window', { fullscreen: false })
    const shown = await command('show', { image: { imageId: 1, articleId: 2, title: 'Test plasma.test — FR2', url: imageUrl, source: null },
      transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false } })
    check(shown.visible && shown.activeImage.imageId === 1 && shown.fr3.activeBackgroundId === split.fr3.activeBackgroundId, 'real HTTP v1 show displays FR2 without changing FR3 background')
    // Render an isolated copy offscreen, so captures do not require a desktop surface.
    control = new BrowserWindow({ show: false, width: 1120, height: 780, frame: false,
      webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, nodeIntegration: false,
        preload: path.resolve(__dirname, '../dist-electron/preload/index.mjs') } })
    await control.loadFile(path.resolve(__dirname, '../dist/index.html'), { query: { view: 'control' } })
    const evaluate = code => control.webContents.executeJavaScript(code)
    const waitFor = async predicate => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await predicate()) return
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      throw new Error('Timed out waiting for expected application state')
    }
    await new Promise(resolve => setTimeout(resolve, 250))
    const backgroundResponse = await evaluate(`fetch(${JSON.stringify(split.backgrounds[0].url)}).then(async response => ({status:response.status,size:(await response.blob()).size}))`)
    check(backgroundResponse.status === 200 && backgroundResponse.size > 0, 'managed background protocol serves native imported image')
    for (const width of [1120, 860, 1920]) {
      control.setSize(width, 780)
      await new Promise(resolve => setTimeout(resolve, 100))
      const layout = await evaluate(`(() => {
        const columns = [...document.querySelectorAll('.output-column')].map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, right: r.right }; });
        const preview = [...document.querySelectorAll('.preview')].map(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; });
        return { columns, preview, width: innerWidth, overflow: document.querySelector('.control-shell').scrollWidth > innerWidth };
      })()`)
      check(layout.columns.length === 2 && layout.columns[0].x < layout.columns[1].x && Math.abs(layout.columns[0].y - layout.columns[1].y) < 2, `two side-by-side columns at ${width}px`)
      check(Math.abs(layout.columns[0].width - layout.columns[1].width) < 2 && !layout.overflow, `equal columns without horizontal overflow at ${width}px`)
      check(layout.preview.every(item => Math.abs(item.width / item.height - 16 / 9) < 0.03), `16:9 previews at ${width}px`)
      const galleryLayout = await evaluate(`(() => {
        const shell = document.querySelector('.control-shell');
        const shellStyle = getComputedStyle(shell);
        const workspace = document.querySelector('.workspace').getBoundingClientRect();
        const gallery = document.querySelector('.background-gallery');
        const tiles = [...gallery.querySelectorAll('.background-tile')];
        const labels = [...document.querySelectorAll('.column-title')];
        return {
          fullWidth: Math.abs(workspace.width - (shell.clientWidth - parseFloat(shellStyle.paddingLeft) - parseFloat(shellStyle.paddingRight))) < 2,
          scrollsLocally: gallery.scrollWidth > gallery.clientWidth && getComputedStyle(gallery).overflowX === 'auto',
          singleRow: tiles.every(tile => Math.abs(tile.getBoundingClientRect().y - tiles[0].getBoundingClientRect().y) < 2),
          textFits: tiles.every(tile => {
            const bounds = tile.getBoundingClientRect();
            return [...tile.querySelectorAll('.background-name, .background-badges, .tile-remove')].every(node => {
              const r = node.getBoundingClientRect();
              return r.left >= bounds.left && r.right <= bounds.right && (node.tagName !== 'BUTTON' || node.scrollWidth <= node.clientWidth);
            });
          }),
          clippedButtons: tiles.flatMap(tile => [...tile.querySelectorAll('.tile-remove')].filter(node => node.scrollWidth > node.clientWidth).map(node => ({ text: node.textContent, contentWidth: node.scrollWidth, width: node.clientWidth }))),
          labelsInCards: labels.length === 2 && labels.every(label => {
            const card = label.closest('.preview-card');
            if (!card) return false;
            const a = label.getBoundingClientRect(), b = card.getBoundingClientRect();
            return a.left >= b.left && a.left - b.left < 20 && a.top >= b.top && a.top - b.top < 20;
          }),
        };
      })()`)
      check(galleryLayout.fullWidth, `screen-wide content at ${width}px`)
      check(galleryLayout.scrollsLocally && galleryLayout.singleRow, `single-row FR3 gallery with local horizontal scrolling at ${width}px`)
      check(galleryLayout.textFits, `long gallery names and button labels stay within cards at ${width}px${galleryLayout.textFits ? '' : `: ${JSON.stringify(galleryLayout.clippedButtons)}`}`)
      check(galleryLayout.labelsInCards, `FR2 and FR3 headings inside preview cards at ${width}px`)
      const refinements = await evaluate(`(() => {
        const column = document.querySelector('.fr2-column');
        const card = column.querySelector('.preview-card');
        const label = card.querySelector('.column-title').getBoundingClientRect();
        const mode = card.querySelector('.window-mode-actions');
        const modeBounds = mode?.getBoundingClientRect();
        return {
          modeInHeader: Boolean(modeBounds && modeBounds.left > label.left && Math.abs((modeBounds.top + modeBounds.height / 2) - (label.top + label.height / 2)) < 4),
          geometryImmediatelyAfterPreview: Boolean(column.children[1]?.classList.contains('geometry-card') && column.children[1].querySelector('.window-bounds')),
          galleryHasOnlyOverlayRemoval: [...document.querySelectorAll('.background-tile')].every(tile => {
            const remove = tile.querySelector('.tile-remove');
            if (!remove || remove.parentElement.closest('button') || tile.querySelector('.tile-actions')) return false;
            const r = remove.getBoundingClientRect(), image = tile.querySelector('.background-thumbnail').getBoundingClientRect();
            const color = getComputedStyle(remove).backgroundColor.match(/[\\d.]+/g)?.map(Number) || [];
            return r.width <= 30 && r.height <= 30 && r.right <= image.right + 2 && r.right >= image.right - 15 && r.top >= image.top - 2 && r.top <= image.top + 15 && color[0] > 120 && color[1] < 100 && color[2] < 100;
          }),
        };
      })()`)
      check(refinements.modeInHeader, `FR2 window modes share the preview heading row at ${width}px`)
      check(refinements.geometryImmediatelyAfterPreview, `FR2 geometry immediately follows preview at ${width}px`)
      check(refinements.galleryHasOnlyOverlayRemoval, `gallery has red corner X controls without rename or nested buttons at ${width}px`)
      const header = await evaluate(`(() => [...document.querySelectorAll('.topbar:first-child > *')].slice(0, 3).map(node => node.getBoundingClientRect().y))()`)
      check(Math.max(...header) - Math.min(...header) < 25, `compact one-row header at ${width}px`)
      const screenshot = await control.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
      writeFileSync(path.join(artifactDir, `control-${width}.png`), screenshot.toPNG())
    }
    await evaluate(`document.querySelector('.control-shell:not([hidden]) .viewer-navigation button:last-child').click()`)
    await new Promise(resolve => setTimeout(resolve, 50))
    const sharedSettings = await evaluate(`(() => {
      const panel = document.querySelector('.control-shell:not([hidden]) .shared-display-settings');
      const fields = panel ? [...panel.querySelectorAll('input[type="number"]')].map(input => Number(input.value)) : [];
      return { inSettings: Boolean(panel), commonSelector: panel?.querySelectorAll('select').length === 1, noControlSelectors: document.querySelectorAll('.workspace select').length === 0, fields };
    })()`)
    check(sharedSettings.inSettings && sharedSettings.commonSelector && sharedSettings.noControlSelectors && sharedSettings.fields.length === 2 && sharedSettings.fields[0] === 3 && sharedSettings.fields[1] === 1, 'Settings contains the sole common monitor selector and default FR2/FR3 order controls')
    const settingsScreenshot = await control.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
    writeFileSync(path.join(artifactDir, 'settings-common-display.png'), settingsScreenshot.toPNG())
    await evaluate(`document.querySelector('.control-shell:not([hidden]) .viewer-navigation button:first-child').click()`)
    await new Promise(resolve => setTimeout(resolve, 50))
    const state = await evaluate('window.viewerApi.getState()')
    check(Array.isArray(state.backgrounds) && Boolean(state.fr3.transform.zoom), 'typed full FR3 state and gallery')
    const physicalDisplay = screen.getAllDisplays().find(display => String(display.id) === state.window.displayId) ?? screen.getPrimaryDisplay()
    const testBounds = { x: physicalDisplay.workArea.x + 80, y: physicalDisplay.workArea.y + 80, width: 640, height: 360 }
    const keyboardBaseline = await evaluate(`window.viewerApi.setWindow({fullscreen:false,bounds:${JSON.stringify(testBounds)}})`)
    control.webContents.send('viewer:state-changed', keyboardBaseline)
    await new Promise(resolve => setTimeout(resolve, 50))
    await evaluate(`document.querySelector('.keyboard-mode').click()`)
    await new Promise(resolve => setTimeout(resolve, 50))
    const pressRight = async (ctrlKey, shiftKey) => {
      await evaluate(`document.querySelector('.keyboard-adjustment').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',ctrlKey:${ctrlKey},shiftKey:${shiftKey},bubbles:true,cancelable:true}))`)
    }
    await pressRight(false, false)
    await waitFor(async () => (await evaluate('window.viewerApi.getState()')).window.bounds.x === keyboardBaseline.window.bounds.x + 10)
    let keyboardState = await evaluate('window.viewerApi.getState()')
    check(keyboardState.window.bounds.x === keyboardBaseline.window.bounds.x + 10, 'renderer keyboard moves FR2 by 10 px without extra scaling')
    control.webContents.send('viewer:state-changed', keyboardState)
    await new Promise(resolve => setTimeout(resolve, 50))
    await pressRight(false, true)
    await waitFor(async () => (await evaluate('window.viewerApi.getState()')).window.bounds.x === keyboardBaseline.window.bounds.x + 60)
    keyboardState = await evaluate('window.viewerApi.getState()')
    check(keyboardState.window.bounds.x === keyboardBaseline.window.bounds.x + 60, 'renderer Shift keyboard moves FR2 by 50 px')
    control.webContents.send('viewer:state-changed', keyboardState)
    await new Promise(resolve => setTimeout(resolve, 50))
    await pressRight(true, false)
    await waitFor(async () => (await evaluate('window.viewerApi.getState()')).window.bounds.width === keyboardBaseline.window.bounds.width + 10)
    keyboardState = await evaluate('window.viewerApi.getState()')
    check(keyboardState.window.bounds.width === keyboardBaseline.window.bounds.width + 10, 'renderer Ctrl keyboard resizes FR2 by 10 px')
    control.webContents.send('viewer:state-changed', keyboardState)
    await new Promise(resolve => setTimeout(resolve, 50))
    await pressRight(true, true)
    await waitFor(async () => (await evaluate('window.viewerApi.getState()')).window.bounds.width === keyboardBaseline.window.bounds.width + 60)
    keyboardState = await evaluate('window.viewerApi.getState()')
    check(keyboardState.window.bounds.width === keyboardBaseline.window.bounds.width + 60, 'renderer Ctrl+Shift keyboard resizes FR2 by 50 px')
    await evaluate(`document.querySelector('.keyboard-mode').click()`)
    const restoredWindow = await evaluate(`window.viewerApi.setWindow({bounds:${JSON.stringify(state.window.bounds)}})`)
    control.webContents.send('viewer:state-changed', restoredWindow)
    await evaluate('window.viewerApi.setFr3({transform:{brightness:121,zoom:1.5,panX:10}})')
    const changed = await evaluate('window.viewerApi.getState()')
    check(changed.fr3.transform.brightness === 121 && changed.fr3.transform.zoom === 1.5 && changed.transform.brightness === state.transform.brightness, 'FR3 adjustments independent from FR2 through real IPC')
    const persisted = JSON.parse(readFileSync(path.join(testProfile, 'viewer-settings.json'), 'utf8'))
    check(persisted.backgrounds.length === 10 && persisted.fr3.activeBackgroundId !== persisted.fr3.selectedBackgroundId && persisted.fr3.transform.zoom === 1.5, 'gallery, separate selection and full FR3 adjustments persisted')
    const collapsed = await evaluate(`(() => {
      const panels = [...document.querySelectorAll('details.transform-panel, .transform-panel details')];
      const initiallyOpen = panels.length === 2 && panels.every(panel => panel.open);
      panels.forEach(panel => panel.querySelector('summary').click());
      return { initiallyOpen, bothClosed: panels.length === 2 && panels.every(panel => !panel.open), controlsHidden: panels.every(panel => !panel.querySelector('.range').checkVisibility()) };
    })()`)
    check(collapsed.initiallyOpen && collapsed.bothClosed && collapsed.controlsHidden, 'both adjustment panels start expanded and collapse independently, hiding slider controls')
    const afterCollapse = await evaluate('window.viewerApi.getState()')
    check(JSON.stringify(afterCollapse.transform) === JSON.stringify(changed.transform) && JSON.stringify(afterCollapse.fr3.transform) === JSON.stringify(changed.fr3.transform), 'collapsing adjustment panels does not change either monitor transform')
    control.webContents.send('viewer:state-changed', afterCollapse)
    await new Promise(resolve => setTimeout(resolve, 50))
    check(await evaluate(`(() => [...document.querySelectorAll('details.transform-panel, .transform-panel details')].every(panel => !panel.open))()`), 'collapsed panels stay closed after a live state update')
    control.webContents.invalidate()
    await new Promise(resolve => setTimeout(resolve, 250))
    const compactScreenshot = await control.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
    writeFileSync(path.join(artifactDir, 'control-collapsed.png'), compactScreenshot.toPNG())
    await evaluate(`document.querySelectorAll('details.transform-panel, .transform-panel details').forEach(panel => panel.querySelector('summary').click())`)
    let confirmationCalls = 0
    dialog.showMessageBox = async () => { confirmationCalls++; return { response: 0 } }
    const selectedBeforeRemoval = afterCollapse.fr3.selectedBackgroundId
    const backgroundToRemove = afterCollapse.backgrounds[2].id
    const removeCandidate = () => evaluate(`document.querySelectorAll('.background-tile')[2].querySelector('.tile-remove').click()`)
    await removeCandidate()
    await waitFor(() => confirmationCalls === 1)
    await new Promise(resolve => setTimeout(resolve, 50))
    const canceledRemoval = await evaluate('window.viewerApi.getState()')
    check(canceledRemoval.backgrounds.length === 10 && canceledRemoval.fr3.selectedBackgroundId === selectedBeforeRemoval, 'clicking corner X requests confirmation and cancellation leaves gallery and selection unchanged')
    dialog.showMessageBox = async () => { confirmationCalls++; return { response: 1 } }
    await removeCandidate()
    await waitFor(async () => (await evaluate('window.viewerApi.getState()')).backgrounds.length === 9)
    const confirmedRemoval = await evaluate('window.viewerApi.getState()')
    check(confirmationCalls === 2 && !confirmedRemoval.backgrounds.some(background => background.id === backgroundToRemove) && confirmedRemoval.fr3.activeBackgroundId === afterCollapse.fr3.activeBackgroundId && confirmedRemoval.fr3.selectedBackgroundId === selectedBeforeRemoval, 'confirmed corner X removes only the chosen non-live background without changing selection')
    const deletedEntry = persisted.backgrounds.find(background => background.id === backgroundToRemove)
    check(existsSync(firstImage) && existsSync(secondImage) && deletedEntry && !existsSync(path.join(testProfile, 'backgrounds', deletedEntry.fileName)), 'confirmed removal deletes the managed copy and preserves the original local file')
    const transformed = await command('transform', { ...changed.transform, brightness: 109 })
    check(transformed.transform.brightness === 109 && transformed.fr3.transform.brightness === 121, 'real HTTP v1 transform affects only FR2')
    const hidden = await command('hide')
    check(!hidden.visible && hidden.activeImage === null && hidden.fr3.visible, 'real HTTP v1 hide leaves FR3 enabled and visible in state')
    const disconnected = await command('disconnect-outputs')
    check(!disconnected.visible && !disconnected.fr3.visible && disconnected.fr3.enabled, 'real HTTP v1 disconnect suppresses both outputs without losing FR3 configuration')
    await evaluate('window.viewerApi.hideFr3()')
    const health = await fetch('http://127.0.0.1:47839/v1/health', { headers: { Authorization: 'Bearer dual-preview-smoke-test' } }).then(response => response.json())
    check(health.protocolVersion === 1, 'HTTP v1 health unchanged')
    await evaluate('window.viewerApi.showFr3()')
    await command('window', { fullscreen: true })
    const defaultFullscreen = await command('show', { image: { imageId: 1, articleId: 2, title: 'Test common display order', url: imageUrl, source: null }, transform: changed.transform })
    check(defaultFullscreen.visible && !defaultFullscreen.fr3.visible, 'default order suppresses FR3 while FR2 is fullscreen on the common monitor')
    const invertedOrder = await evaluate('window.viewerApi.setOutputOrder({fr2:1,fr3:3})')
    check(invertedOrder.outputOrder.fr2 === 1 && invertedOrder.outputOrder.fr3 === 3 && invertedOrder.fr3.visible && invertedOrder.fr3.displayId === invertedOrder.window.displayId, 'inverted order keeps fullscreen FR3 above fullscreen FR2 on the common monitor')
    const tiedOrder = await evaluate('window.viewerApi.setOutputOrder({fr2:2,fr3:2})')
    check(!tiedOrder.fr3.visible, 'equal output order keeps FR2 above FR3 deterministically')
    await evaluate('window.viewerApi.setOutputOrder({fr2:3,fr3:1})')
    const persistedOrder = JSON.parse(readFileSync(path.join(testProfile, 'viewer-settings.json'), 'utf8'))
    check(persistedOrder.outputOrder.fr2 === 3 && persistedOrder.outputOrder.fr3 === 1 && persistedOrder.window.displayId === persistedOrder.fr3.displayId, 'output order and shared monitor persist without changing HTTP v1')
    await command('disconnect-outputs')
    await evaluate('window.viewerApi.hideFr3()')
    check(results.errors.length === 0, 'no renderer console errors')
    copyFileSync(path.join(testProfile, 'viewer-settings.json'), path.join(testProfile, 'viewer-settings.expected-restart.json'))
    writeFileSync(resultsPath, JSON.stringify(results, null, 2))
    console.log(JSON.stringify(results))
    clearTimeout(timeout)
    imageServer.close()
    app.quit()
  } catch (error) {
    results.errors.push(String(error.stack || error))
    writeFileSync(resultsPath, JSON.stringify(results, null, 2))
    console.error(JSON.stringify(results))
    clearTimeout(timeout)
    imageServer.close()
    app.exit(1)
  }
}
