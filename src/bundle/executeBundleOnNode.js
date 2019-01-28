export const executeBundleOnNode = (moduleSpecifier, file = process.cwd()) => {
  require("systemjs/dist/system.js")
  const fs = require("fs")
  const { Script } = require("vm")

  global.System.instantiate = (id) => {
    const code = fs.readFileSync(id)

    const script = new Script(code, { filename: id })
    script.runInThisContext()
    return global.System.getRegister()
  }
  global.System.import(moduleSpecifier, file)
}

// executeBundleOnNode("./async-await.js")
