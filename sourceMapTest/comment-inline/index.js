const http = require("http")
const fs = require("fs")
const vm = require("vm")

const server = http.createServer()

server.on("request", (request, response) => {
  const sourceMapContent = fs.readFileSync(`${__dirname}/compiled/file.es5.js.map`).toString()

  response.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-length": Buffer.byteLength(sourceMapContent),
  })
  console.log("serving source map to", request.url)
  response.end(sourceMapContent)
})

const port = 8567
server.listen(port, "127.0.0.1", function(error) {
  if (error) {
    throw error
  } else {
    const concreteFilename = `${__dirname}/build/file.es5.js/file.es5.js`
    const content = fs.readFileSync(concreteFilename).toString()

    const script = new vm.Script(content, { filename: `http://127.0.0.1:${port}/compiled/file.js` })

    script.runInThisContext()
  }
})
