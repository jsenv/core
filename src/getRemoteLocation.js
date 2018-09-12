export const getRemoteLocation = ({ server, file }) => {
  const remoteRoot = server.url.toString().slice(0, -1)

  return `${remoteRoot}/${server.abstractFolderRelativeLocation}/${file}`
}
