const fs = require("fs")
const vm = require("vm")

const abstractFilename = `${__dirname}/compiled/file.es5.js`
const concreteFilename = `${__dirname}/build/file.es5.js/file.es5.js`
const content = fs.readFileSync(concreteFilename).toString()

const script = new vm.Script(content, { filename: abstractFilename })

script.runInThisContext()
