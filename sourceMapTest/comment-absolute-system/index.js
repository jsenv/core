global.System = {}
global.System.register = (stuff, callback) => {
  const expose = (name, value) => {
    console.log("exported", value, "under", name)
  }
  const context = {}

  const result = callback(expose, context)

  result.execute()
}

const fs = require("fs")

const source = fs.readFileSync(`${__dirname}/file.es5.js`).toString()

eval(source)
