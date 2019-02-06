export const evalSource = (code, filename) => window.eval(appendSourceURL(code, filename))

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}
