export function setPackagedEnvironment(
  isPackaged: boolean,
  env: Record<string, string | undefined>,
) {
  if (isPackaged) {
    env.APP_ENV = 'production'
  }
}
