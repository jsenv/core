export const fromFetchResponse = (fetchResponse) => {
  const responseHeaders = {}
  const headersToIgnore = ["connection"]
  fetchResponse.headers.forEach((value, name) => {
    if (!headersToIgnore.includes(name)) {
      responseHeaders[name] = value
    }
  })
  return {
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
    headers: responseHeaders,
    body: fetchResponse.body, // node-fetch assumed
  }
}
