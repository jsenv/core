export const basicFetch = async (
  url,
  { method = "GET", headers = {} } = {},
) => {
  let requestModule
  if (url.startsWith("http:")) {
    requestModule = await import("node:http")
  } else {
    requestModule = await import("node:https")
  }
  const { request } = requestModule

  const urlObject = new URL(url)

  return new Promise((resolve, reject) => {
    const req = request({
      hostname: urlObject.hostname,
      port: urlObject.port,
      path: urlObject.pathname,
      method,
      headers,
    })
    req.on("response", (response) => {
      req.setTimeout(0)
      let responseBody = ""
      response.setEncoding("utf8")
      response.on("data", (chunk) => {
        responseBody += chunk
      })
      response.on("end", () => {
        req.destroy()
        if (response.headers["content-type"] === "application/json") {
          resolve(JSON.parse(responseBody))
        } else {
          resolve(responseBody)
        }
      })
    })
    req.on("error", reject)
    req.end()
  })
}
