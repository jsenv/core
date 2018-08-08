import path from "path"
import { open } from "./run-server.js"

const getFromArguments = (name) => {
  const foundRawArg = process.argv.find((arg) => {
    return arg.startsWith(`--${name}=`)
  })
  if (!foundRawArg) {
    return
  }
  return foundRawArg.slice(`--${name}=`.length)
}

const root = getFromArguments("root") || path.resolve(__dirname, "../../")
const port = Number(getFromArguments("port") || "3000")

open({
  root,
  compiledFolder: "compiled",
  url: `http://127.0.0.1:${port}`,
}).then(({ compileServerURL, runServerURL }) => {
  console.log("compile server listening at", compileServerURL.toString())
  console.log(`run server listening at ${runServerURL}`)
})
