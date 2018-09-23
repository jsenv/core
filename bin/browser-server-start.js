#!/usr/bin/env node

import { getFromProcessArguments } from "./getFromProcessArguments.js"
import killPort from "kill-port"
import { openBrowserServer } from "../src/openBrowserServer/openBrowserServer.js"

const port = Number(getFromProcessArguments("port") || "3000")
const root = getFromProcessArguments("root") || process.cwd()

killPort(port).then(() => {
  openBrowserServer({
    port,
    root,
  })
})
