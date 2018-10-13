const http = require("http")
const fs = require("fs")

const server = http.createServer()

const getContentType = (fileRelativeName) => {
  if (fileRelativeName.endsWith(".html")) {
    return "text/html"
  }
  if (fileRelativeName.endsWith(".js")) {
    return "application/javascript"
  }
  return "application/octet-stream"
}

server.on("request", (request, response) => {
  const pathname = request.url.slice(1)
  const fileRelativeName = pathname === "" ? "index.html" : pathname
  let fileContent
  try {
    fileContent = fs.readFileSync(`${__dirname}/${fileRelativeName}`).toString()
  } catch (e) {
    console.log(`404 ${fileRelativeName}`)
    response.writeHead(404, {
      "cache-control": "no-store",
    })
    response.end()
    return
  }
  const contentType = getContentType(fileRelativeName)

  console.log(`200 ${fileRelativeName}`)
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": contentType,
    "content-length": Buffer.byteLength(fileContent),
  })
  response.end(fileContent)
})

const port = 8567
server.listen(port, "127.0.0.1", function(error) {
  if (error) {
    throw error
  }
  console.log(`server listening at http://127.0.0.1:${port}`)
})
