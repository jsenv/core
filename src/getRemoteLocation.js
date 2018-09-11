export const getRemoteLocation = ({ remoteRoot, file, transpile, instrument }) => {
  if (instrument) {
    return `${remoteRoot}/instrumented/${file}`
  }
  if (transpile) {
    return `${remoteRoot}/compiled/${file}`
  }
  return `${remoteRoot}/${file}`
}
