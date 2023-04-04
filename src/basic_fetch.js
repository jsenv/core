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
      resolve({
        status: response.statusCode,
        headers: response.headers,
        json: () => {
          req.setTimeout(0)
          req.destroy()
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
            response.on("error", (e) => {
              reject(e)
            })
          })
        },
      })
    })
    req.on("error", reject)
    req.end()
  })
}
