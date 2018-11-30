import { assert } from "@dmail/assert"
import { createMaterial } from "./material.js"
import { expectZeroUnhandledRejection } from "../../expectZeroUnhandledRejection.js"

expectZeroUnhandledRejection()

const test = async () => {
  const { execution, wait, firstPlatform } = createMaterial()

  firstPlatform.opened.resolve()
  await firstPlatform.opened
  await wait()

  firstPlatform.executed.resolve()
  await execution
  firstPlatform.closed.reject("foo")

  // this time we expec the unhandled rejection
  // when the platform is closed because of a rejection
  // we let unhandled rejection happens
  // in the case of hotreloading we may want to catch this
  // but we'll see when implementing hotreloading
  process.on("unhandledRejection", async (error, promise) => {
    const actual = error
    const expected = "foo"
    assert({ actual, expected })
    promise.catch(() => {})
  })
}

test()
