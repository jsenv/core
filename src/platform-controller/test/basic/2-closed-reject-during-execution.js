import { assert } from "@dmail/assert"
import { createMaterial } from "../material.js"
import { expectZeroUnhandledRejection } from "../../../expectZeroUnhandledRejection.js"

expectZeroUnhandledRejection()

const test = async () => {
  const { execution, wait, firstPlatform } = createMaterial()

  firstPlatform.opened.resolve()
  await firstPlatform.opened
  await wait()

  firstPlatform.closed.reject("foo")
  const actual = await execution.catch((e) => e)
  const expected = "foo"
  assert({ actual, expected })
}

test()
