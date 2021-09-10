// eslint-disable-next-line no-eval
export const evalSource = (code, href) =>
  window.eval(appendSourceURL(code, href))

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}
