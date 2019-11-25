import { fetchUsingXHR } from "internal/fetchUsingXHR.js"

export const loadScript = async (url) => {
  const { status, body } = await fetchUsingXHR(url)
  if (status >= 200 && status <= 299) {
    // eslint-disable-next-line no-eval
    window.eval(appendSourceURL(body, url))
  } else {
    throw new Error(createUnexpectedScriptResponseMessage({ url, status, body }))
  }
}

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}

const createUnexpectedScriptResponseMessage = ({
  url,
  status,
  body,
}) => `Unexpected response for script.
--- script url ---
${url}
--- response body ---
${body}
--- response status ---
${status}`
