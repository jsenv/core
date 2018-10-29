import { test } from "@dmail/test"
import { processTeardown } from "./processTeardown.js"

test(() => {
  processTeardown((reason) => {
    console.log(reason)
  })
})
