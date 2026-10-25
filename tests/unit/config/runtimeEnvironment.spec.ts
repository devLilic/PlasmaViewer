import { describe, expect, it } from 'vitest'
import { setPackagedEnvironment } from '../../../config/runtimeEnvironment'

describe('packaged runtime environment', () => {
  it('selects production config for packaged Electron apps', () => {
    const env: Record<string, string | undefined> = { NODE_ENV: undefined }

    setPackagedEnvironment(true, env)

    expect(env.APP_ENV).toBe('production')
  })

  it('leaves development environment selection unchanged in dev', () => {
    const env: Record<string, string | undefined> = { APP_ENV: 'development' }

    setPackagedEnvironment(false, env)

    expect(env.APP_ENV).toBe('development')
  })
})
