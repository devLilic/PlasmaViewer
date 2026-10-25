import type { ProgressInfo } from 'electron-updater'
import { useEffect, useState } from 'react'
import type { UpdateErrorPayload, UpdateStateEvent, VersionInfo } from '@/shared/types/update'
import { initialUpdateViewState, reduceUpdateState } from './state'

interface UpdateState {
  checking: boolean
  modalOpen: boolean
  readyToInstall: boolean
  updateAvailable: boolean
  versionInfo?: VersionInfo
  updateError?: UpdateErrorPayload
  progressInfo?: Partial<ProgressInfo>
  checkForUpdates: () => Promise<void>
  closeModal: () => void
  confirmAction: () => Promise<void>
}

export function useUpdateState(): UpdateState {
  const [checking, setChecking] = useState(false)
  const [state, setState] = useState(initialUpdateViewState)

  useEffect(() => {
    const unsubscribe = window.updateApi.onStateChange((event) => {
      setState((currentState) => reduceUpdateState(currentState, event))
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return {
    checking,
    modalOpen: state.modalOpen,
    readyToInstall: state.readyToInstall,
    updateAvailable: state.updateAvailable,
    versionInfo: state.versionInfo,
    updateError: state.updateError,
    progressInfo: state.progressInfo,
    async checkForUpdates() {
      setChecking(true)
      try {
        const result = await window.updateApi.checkForUpdates() as { message?: string; error?: unknown } | null
        setState((currentState) => ({
          ...currentState,
          modalOpen: true,
          progressInfo: { percent: 0 },
        }))

        if (result?.error) {
          const error = result.error instanceof Error ? result.error : new Error(result.message ?? 'Eroare la verificarea actualizărilor.')
          setState((currentState) => ({
            ...currentState,
            updateAvailable: false,
            updateError: { message: result.message ?? error.message, error },
          }))
        }
      } catch (value) {
        const error = value instanceof Error ? value : new Error('Eroare la verificarea actualizărilor.')
        setState((currentState) => ({
          ...currentState,
          modalOpen: true,
          updateAvailable: false,
          updateError: { message: error.message, error },
        }))
      } finally {
        setChecking(false)
      }
    },
    closeModal() {
      setState((currentState) => ({
        ...currentState,
        modalOpen: false,
      }))
    },
    async confirmAction() {
      if (state.readyToInstall) {
        await window.updateApi.quitAndInstall()
        return
      }

      await window.updateApi.downloadUpdate()
    },
  }
}
