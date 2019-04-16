const nodeFetch = import.meta.require("node-fetch")

export const fetch = async (url) => {
  const nodeResponse = await nodeFetch(url)
  // { ... } because response.headers.raw() an object create with Object.create(null)
  const headers = { ...nodeResponse.headers.raw() }

  return {
    status: nodeResponse.status,
    statusText: nodeResponse.statusText,
    headers,
    // https://github.com/bitinn/node-fetch#bodytext
    text: () => nodeResponse.text(),
    json: () => nodeResponse.json(),
  }
}
