import { fetchUsingXHR } from "./fetchUsingXHR.js"

const appendSourceURL = (code, sourceURL) => {
  return `${code}
${"//#"} sourceURL=${sourceURL}`
}

const evalSource = (code, url) => {
  window.eval(appendSourceURL(code, url))
}

export const fetchSource = (url, parent) => {
  return fetchUsingXHR(url, {
    "x-module-referer": parent || url,
  }).then(({ status, headers, reason, body }) => {
    if (status < 200 || status >= 400) {
      return Promise.reject({ status, reason, headers, body })
    }

    if (headers["content-type"] === "application/javascript") {
      return {
        type: "js",
        instantiate: () => evalSource(body, url),
      }
    }

    if (headers["content-type"] === "application/json") {
      return {
        type: "json",
        instantiate: () => JSON.parse(body),
      }
    }

    return {
      type: "unsupported",
      instantiate: () => undefined,
    }
  })
}
