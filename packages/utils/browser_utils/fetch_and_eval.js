import { browserFetch } from "./fetch_browser.js"

export const fetchAndEval = async (url) => {
  const response = await browserFetch(url)

  if (response.status >= 200 && response.status <= 299) {
    const text = await response.text()
    // eslint-disable-next-line no-eval
    window.eval(appendSourceURL(text, url))
  } else {
    const text = await response.text()
    throw new Error(
      `Unexpected response for script.
--- script url ---
${url}
--- response body ---
${text}
--- response status ---
${response.status}`,
    )
  }
}

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}
