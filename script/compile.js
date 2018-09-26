const { compileRoot } = require("@dmail/project-structure-compile-babel")
const path = require("path")

compileRoot({
  root: path.resolve(__dirname, "../"),
  into: "dist",
  name: "node",
  version: "8.0",
})
