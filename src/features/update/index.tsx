import Modal from './components/Modal'
import Progress from './components/Progress'
import { useUpdateState } from './useUpdateState'
import './update.css'
import { useTranslation } from 'react-i18next'

const UpdateFeature = () => {
  const { t } = useTranslation('updater')
  const {
    checking,
    modalOpen,
    readyToInstall,
    updateAvailable,
    versionInfo,
    updateError,
    progressInfo,
    checkForUpdates,
    closeModal,
    confirmAction,
  } = useUpdateState()

  return (
    <>
      <Modal
        open={modalOpen}
        title={t('title', { defaultValue: 'Actualizări' })}
        cancelText={readyToInstall ? t('later', { defaultValue: 'Mai târziu' }) : t('cancel', { defaultValue: 'Anulează' })}
        okText={readyToInstall ? t('installNow', { defaultValue: 'Instalează acum' }) : t('download', { defaultValue: 'Descarcă actualizarea' })}
        onCancel={closeModal}
        onOk={() => void confirmAction()}
        footer={updateAvailable ? null : undefined}
      >
        <div className='modal-slot'>
          {updateError ? (
            <div>
              <p>{t('error', { defaultValue: 'Actualizarea nu a putut fi verificată sau descărcată.' })}</p>
              <p>{updateError.message}</p>
            </div>
          ) : updateAvailable ? (
            <div>
              <div>{t('available', { defaultValue: 'Este disponibilă o actualizare.' })} v{versionInfo?.newVersion}</div>
              <div className='new-version__target'>v{versionInfo?.version} -&gt; v{versionInfo?.newVersion}</div>
              <div className='update__progress'>
                <div className='progress__title'>{t('progress', { defaultValue: 'Progres descărcare:' })}</div>
                <div className='progress__bar'>
                  <Progress percent={progressInfo?.percent} />
                </div>
              </div>
            </div>
          ) : (
            <div className='can-not-available'>{t('notAvailable', { defaultValue: 'Nu este disponibilă o versiune mai nouă.' })}</div>
          )}
        </div>
      </Modal>
      <button className="primary update-check-button" disabled={checking} onClick={() => void checkForUpdates()}>
        {checking ? t('checking', { defaultValue: 'Se verifică…' }) : t('check', { defaultValue: 'Verifică actualizările' })}
      </button>
    </>
  )
}

export default UpdateFeature
