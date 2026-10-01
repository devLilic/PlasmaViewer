// Static ESM imports keep Electron's protocol registration before app.ready.
import smoke from './verify-dual-preview.cjs'
import '../dist-electron/main/index.js'
void smoke.verify()
