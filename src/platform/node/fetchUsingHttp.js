import https from "https"
import fetch from "node-fetch"

// ideally we should only pass this to the fetch below
https.globalAgent.options.rejectUnauthorized = false

export const fetchUsingHttp = async (url, parent) => {
  const response = await fetch(url, {
    headers: {
      "x-module-referer": parent || url,
    },
  })

  const text = await response.text()
  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseToHeaderMap(response),
    body: text,
  }
}

const responseToHeaderMap = (response) => {
  const headerMap = {}
  response.headers.forEach((value, name) => {
    headerMap[name] = value
  })
  return headerMap
}
