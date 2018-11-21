const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}

export const evalSource = (code, { remoteFile }) => {
  window.eval(appendSourceURL(code, remoteFile))
}
