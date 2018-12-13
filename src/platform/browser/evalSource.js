export const evalSource = (code, { remoteFile }) => {
  window.eval(appendSourceURL(code, remoteFile))
}

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}
