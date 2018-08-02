const fs = require("fs")
const vm = require("vm")

const filename = `${__dirname}/build/file.es5.js`
const content = fs.readFileSync(filename).toString()

const script = new vm.Script(content, { filename })

script.runInThisContext()
