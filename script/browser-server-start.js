const { openBrowserServer } = require("../dist/index.js")
const path = require("path")

const root = path.resolve(__dirname, "../")

openBrowserServer({
  root,
  into: "build",
  watch: true,
})
