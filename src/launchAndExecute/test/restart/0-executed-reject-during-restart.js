import { assert } from "@dmail/assert"
import { createMaterial } from "../material.js"
import { expectZeroUnhandledRejection } from "../../../expectZeroUnhandledRejection.js"

expectZeroUnhandledRejection()

const test = async () => {
  const { execution, wait, restart, firstPlatform, secondPlatform } = createMaterial()

  firstPlatform.opened.resolve()
  await firstPlatform.opened
  await wait() // required otherwise restartable.onrestart not assigned yet
  restart("restart")
  firstPlatform.executed.reject("foo") // ignored because we're restarting
  // i'm not sure we absolutely want to ignore an error like that
  // but restarting means I don't care

  firstPlatform.closed.resolve()
  secondPlatform.opened.resolve()
  secondPlatform.executed.resolve(2)

  const actual = await execution
  const expected = 2
  assert({ actual, expected })
}

test()
