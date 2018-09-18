#!/usr/bin/env node

import { openNodeClient } from "../src/openNodeClient/openNodeClient.js"

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
  compileURL: "http://127.0.0.1:3001/compiled",
}).then(({ execute }) => {
  execute({ file, executeTest: false })
})
