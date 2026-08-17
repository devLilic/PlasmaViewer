import { describe, expect, it } from 'vitest'
import { ipcEventChannels, ipcInvokeChannels } from '../../../src/shared/ipc/contracts'

describe('ipc contracts', () => {
  it('defines unique invoke channels for each supported domain', () => {
    const channels = Object.values(ipcInvokeChannels)

    expect(channels).toEqual([
      'app:get-info',
      'app:open-window',
      'i18n:get-current-language',
      'i18n:get-supported-languages',
      'i18n:get-resources',
      'i18n:set-language',
      'update:check-for-updates',
      'update:start-download',
      'update:quit-and-install',
      'licensing:get-status',
      'licensing:activate',
      'licensing:request-reauthorization',
      'licensing:confirm-rebind',
      'licensing:get-entitlements',
      'database:query',
      'settings:get',
      'settings:set',
      'viewer:get-state',
      'viewer:set-transform',
      'viewer:set-window',
      'viewer:choose-default-image',
      'viewer:clear-default-image',
      'viewer:reset-transform',
      'viewer:show-output',
      'viewer:hide-output',
    ])
    expect(new Set(channels).size).toBe(channels.length)
  })

  it('defines unique renderer event channels for app and update notifications', () => {
    const channels = Object.values(ipcEventChannels)

    expect(channels).toEqual([
      'app:main-process-message',
      'update:state-changed',
      'update:availability-changed',
      'update:error',
      'update:download-progress',
      'update:downloaded',
      'viewer:state-changed',
    ])
    expect(new Set(channels).size).toBe(channels.length)
  })
})
