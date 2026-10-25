import path from 'node:path'

export function resolveWindowIconPath({
  isPackaged,
  resourcesPath,
  appRoot,
}: {
  isPackaged: boolean
  resourcesPath: string
  appRoot: string
}) {
  return isPackaged
    ? path.join(resourcesPath, 'icon.ico')
    : path.join(appRoot, 'build', 'icon.ico')
}
