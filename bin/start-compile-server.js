#!/usr/bin/env node

import { openCompileServer } from "../src/openCompileServer/openCompileServer.js"
import path from "path"
import killPort from "kill-port"

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
const port = Number(getFromArguments("port") || "3001")
const folder = getFromArguments("folder") || "compiled"

const open = () =>
  openCompileServer({
    rootLocation: root,
    abstractFolderRelativeLocation: folder,
    url: `http://127.0.0.1:${port}`, // avoid https for now because certificates are self signed
  }).then((compileServer) => {
    console.log(`compile server listening at ${compileServer.url}`)
  })

killPort(port).then(open)
