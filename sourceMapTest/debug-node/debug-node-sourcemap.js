const fs = require("fs")
const vm = require("vm")
const http = require("http")

const server = http.createServer()

server.on("request", (request, response) => {
  console.log("serving", request.url)

  const sourceMapContent = fs.readFileSync(`${__dirname}${request.url}`).toString()

  response.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-length": Buffer.byteLength(sourceMapContent),
  })
  response.end(sourceMapContent)
})

const port = 8567
server.listen(port, "127.0.0.1", function(error) {
  if (error) {
    throw error
  } else {
    const concreteFilename = `${__dirname}/file.es5.js`
    const abstractFilename = `http://127.0.0.1:${port}/file.es5.js`
    const source = fs.readFileSync(concreteFilename).toString()
    const script = new vm.Script(source, { filename: abstractFilename })

    script.runInThisContext()
  }
})
