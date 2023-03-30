export const basicFetch = async (
  url,
  { rejectUnauthorized = true, method = "GET", headers = {} } = {},
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
      rejectUnauthorized,
      hostname: urlObject.hostname,
      port: urlObject.port,
      path: urlObject.pathname,
      method,
      headers,
    })
    req.on("response", (response) => {
      req.setTimeout(0)
      req.destroy()
      resolve({
        status: response.statusCode,
        headers: response.headers["content-type"],
        json: () => {
          return new Promise((resolve) => {
            if (response.headers["content-type"] !== "application/json") {
              console.warn("not json")
            }
            let responseBody = ""
            response.setEncoding("utf8")
            response.on("data", (chunk) => {
              responseBody += chunk
            })
            response.on("end", () => {
              resolve(JSON.parse(responseBody))
            })
          })
        },
      })
    })
    req.on("error", reject)
    req.end()
  })
}
