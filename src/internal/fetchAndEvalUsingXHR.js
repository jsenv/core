import { fetchUsingXHR } from "./fetchUsingXHR.js"

export const fetchAndEvalUsingXHR = async (url) => {
  const { status, body } = await fetchUsingXHR(url)
  if (status >= 200 && status <= 299) {
    // eslint-disable-next-line no-eval
    window.eval(appendSourceURL(body, url))
  } else {
    throw new Error(`Unexpected response for script.
--- script url ---
${url}
--- response body ---
${body}
--- response status ---
${status}`)
  }
}

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}
