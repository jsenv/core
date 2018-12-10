import { assert } from "@dmail/assert"
import { createMaterial } from "../material.js"
import { expectZeroUnhandledRejection } from "../../../expectZeroUnhandledRejection.js"

expectZeroUnhandledRejection()

const test = async () => {
  const { execution, wait, cancel, firstPlatform } = createMaterial()

  firstPlatform.opened.resolve()
  await firstPlatform.opened
  await wait()

  firstPlatform.executed.resolve("foo")
  cancel("cancel")
  const actual = await execution
  assert({ actual, expected: "foo" })

  {
    const actual = await firstPlatform.closed
    const expected = "cancel"
    assert({ actual, expected })
  }
}

test()
