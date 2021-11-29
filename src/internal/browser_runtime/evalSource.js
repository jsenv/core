/* eslint-env browser */

export const evalSource = (code, href) => {
  // eslint-disable-next-line no-eval
  return window.eval(appendSourceURL(code, href))
}

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}
