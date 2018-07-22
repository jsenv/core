import SystemJS from "systemjs"
import vm from "vm"
// import path from "path"
import { readFileAsString } from "../readFileAsString.js"

const getNodeFilename = (filename) => {
  filename = String(filename)
  // filename = path.resolve(process.cwd(), filename)
  filename = filename.replace(/\\/g, "/")

  // this logic sucks, let's try to avoid it completely
  // if (filename.slice(0, 2) === "//") {
  // 	filename = `${projectRoot}/${filename.slice(2)}`
  // } else if (filename[0] === "/") {
  // 	filename = `${rootFolder}/${filename.slice(2)}`
  // } else {
  // 	filename = `${rootFolder}/${filename}`
  // }

  if (filename.startsWith("file:///")) {
    return filename.slice("file:///".length)
  }

  return filename
}

export const createSystem = ({ transpile }) => {
  const mySystem = new SystemJS.constructor()
  const { instantiate } = SystemJS.constructor

  mySystem[instantiate] = function(key, processAnonRegister) {
    if (key.startsWith("@node/")) {
      return SystemJS[instantiate].apply(this, arguments)
    }

    const filename = getNodeFilename(key)

    return readFileAsString(filename).then((source) => {
      return transpile(source, { filename }).then((source) => {
        global.System = mySystem
        vm.runInThisContext(source, { filename })
        delete global.System
        processAnonRegister()
      })
    })
  }

  mySystem.meta["*.json"] = { format: "json" }

  return mySystem
}
