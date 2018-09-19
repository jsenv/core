#!/usr/bin/env node

import { openNodeClient } from "../src/openNodeClient/openNodeClient.js"
import path from "path"

// additional ../ to get rid of dist
const rootLocation = path.resolve(__dirname, "../../")

const getFromArguments = (name) => {
  const foundRawArg = process.argv.find((arg) => {
    return arg.startsWith(`--${name}=`)
  })
  if (!foundRawArg) {
    return
  }
  return foundRawArg.slice(`--${name}=`.length)
}

const file = getFromArguments("file")

openNodeClient({
  localRoot: rootLocation,
  // remoteRoot: "http://127.0.0.1:3001",
  compileURL: "http://127.0.0.1:3001/compiled",
  detached: false,
}).then(({ execute }) => {
  execute({ file, executeTest: false })
})
