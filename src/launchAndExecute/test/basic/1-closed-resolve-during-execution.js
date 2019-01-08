import { assert } from "@dmail/assert"
import { createMaterial } from "../material.js"
import { expectZeroUnhandledRejection } from "../../../expectZeroUnhandledRejection.js"

expectZeroUnhandledRejection()

const test = async () => {
  const { execution, wait, firstPlatform } = createMaterial()

  firstPlatform.opened.resolve()
  await firstPlatform.opened
  await wait()

  firstPlatform.closed.resolve("closed")
  const actual = await execution.catch((e) => e)
  const expected = new Error(actual.message)
  expected.code = "PLATFORM_CLOSED_DURING_EXECUTION_ERROR"
  assert({ actual, expected })
}

test()
