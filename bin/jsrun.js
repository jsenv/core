#!/usr/bin/env node

import { getFromProcessArguments } from "./getFromProcessArguments.js"
// import path from "path"
import { openCompileServer } from "../src/openCompileServer/openCompileServer.js"
import { openNodeClient } from "../src/openNodeClient/openNodeClient.js"
import { openChromiumClient } from "../src/openChromiumClient/openChromiumClient.js"

const root = process.cwd()
const file = process.argv[1]
if (file.startsWith(root) === false) {
  throw new Error(`file must be inside ${root}, got ${file}`)
}
const relativeFile = file.slice(root.length + 1)

// const watch = getFromProcessArguments("watch") || false
const platform = getFromProcessArguments("platform") || "node"
const instrument = getFromProcessArguments("instrument") || false
const port = getFromProcessArguments("post ") || 0
const isTestFile = false

const autoClose = false // bah ca se gere tout seul je pense

const openServer = () => {
  return openCompileServer({
    rootLocation: root,
    abstractFolderRelativeLocation: "compiled",
    url: `http://127.0.0.1:0${port}`, // avoid https for now because certificates are self signed
    instrument,
  })
}

const createClient = (server) => {
  if (platform === "node") {
    return openNodeClient({
      compileURL: server.compileURL,
      localRoot: root,
      detached: true,
      // remoteRoot: "http://127.0.0.1:3001",
    })
  }
  if (platform === "chromium") {
    const headless = getFromProcessArguments("headless") || false

    return openChromiumClient({
      compileURL: server.compileURL,
      headless,
    })
  }
}

openServer().then((server) => {
  console.log(`server listening at ${server.url}`)
  return createClient(server)
    .then((client) => {
      return client.execute({
        file: relativeFile,
        collectCoverage: instrument,
        collectTest: isTestFile,
        autoClose,
      })
    })
    .then(() => {
      server.close()
    })
})
