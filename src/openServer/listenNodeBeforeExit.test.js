import { test } from "@dmail/test"
import { listenNodeBeforeExit } from "./listenNodeBeforeExit.js"

test(() => {
  listenNodeBeforeExit(() => {})
})
