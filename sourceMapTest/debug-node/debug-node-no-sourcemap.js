const fs = require("fs")
const vm = require("vm")

const concreteFilename = `${__dirname}/file.js`
const abstractFilename = concreteFilename
// const abstractFilename = `http://127.0.0.1:8000/file.js`
const source = fs.readFileSync(concreteFilename).toString()

const script = new vm.Script(source, { filename: abstractFilename })

script.runInThisContext()
