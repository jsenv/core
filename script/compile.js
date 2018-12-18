const compile = require("./compile-source.js")

compile.then(() => {
  require("./compile-browser-platform.js")
  require("./compile-browser-system-importer.js")
})
