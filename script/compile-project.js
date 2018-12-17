const path = require("path")
const { compileProject } = require("../dist/src/compileProject/index.js")

const localRoot = path.resolve(__dirname, "../")
const compileInto = "build"

compileProject({ localRoot, compileInto })
