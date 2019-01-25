export const evalSource = (code, { remoteFile }) => evalSourceAt(code, remoteFile)

export const evalSourceAt = (code, sourceURL) => window.eval(appendSourceURL(code, sourceURL))

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}
