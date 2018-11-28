import { createThenableConstructor } from "./thenable.js"
import { expectZeroUnhandledRejection } from "../expectZeroUnhandledRejection.js"
import assert from "assert"

expectZeroUnhandledRejection()

const test = async () => {
  // throw in execute
  {
    const Thenable = createThenableConstructor()
    const testError = new Error()
    const thenable = new Thenable(() => {
      throw testError
    })
    try {
      await thenable
      assert.fail("must not be called")
    } catch (e) {
      assert.deepEqual(e, testError)
    }
  }

  // throw in then
  {
    const Thenable = createThenableConstructor()
    let resolve
    const thenable = new Thenable((res) => {
      resolve = res
    })
    const testError = new Error()

    const nextThenable = thenable.then(() => {
      throw testError
    })
    resolve()

    try {
      await nextThenable
      assert.fail("must not be called")
    } catch (error) {
      assert.deepEqual(error, testError)
    }
  }

  // resolve unwrapping
  {
    const Thenable = createThenableConstructor()
    const thenableA = new Thenable((resolve) => resolve(10))
    const thenableB = new Thenable((resolve) => resolve(thenableA))
    const thenableC = new Thenable((resolve) => resolve(thenableB))
    const actual = await thenableC
    const expected = 10

    assert.deepEqual(actual, expected)
  }

  // rejectionUnhandled / rejectionHandled
  {
    let handledThenable
    const rejectionHandled = (thenable) => {
      handledThenable = thenable
    }
    let unhandledRejection
    let unhandledThenable
    const rejectionUnhandled = (error, thenable) => {
      unhandledRejection = error
      unhandledThenable = thenable
    }
    const Thenable = createThenableConstructor({ rejectionHandled, rejectionUnhandled })
    const testError = new Error()
    const thenable = new Thenable(() => {
      throw testError
    })

    await new Promise((resolve) => setTimeout(resolve))
    assert.deepEqual(handledThenable, undefined)
    assert.deepEqual(unhandledRejection, testError)
    assert.deepEqual(unhandledThenable, thenable)
    const nextThenable = thenable.then()
    assert.deepEqual(handledThenable, thenable)
    await new Promise((resolve) => setTimeout(resolve))
    assert.deepEqual(unhandledRejection, testError)
    assert.deepEqual(unhandledThenable, nextThenable)
  }

  console.log("passed")
}
test()
