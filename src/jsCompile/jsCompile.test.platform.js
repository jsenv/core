import path from "path"
import assert from "assert"
import { jsCompile } from "./jsCompile.js"

const localRoot = path.resolve(__dirname, "../../../")
const file = `__platform__.js`
const fileAbsolute = `${localRoot}/src/platform/browser/index.js`

debugger

jsCompile({
  file,
  fileAbsolute,
  plugins: [],
}).then(({}) => {
  debugger
})
