import { subscribe } from "./subscribe.js"
import assert from "assert"

const test = async () => {
  // cleanup
  {
    let installed = false
    const generator = () => {
      installed = true
      return () => {
        installed = false
      }
    }

    assert.equal(installed, false)
    const subscription = subscribe(generator, { next: () => {} })
    assert.equal(installed, true)
    subscription.unsubscribe()
    assert.equal(installed, false)
  }

  // unsubscribe returns cleanup value
  {
    const generator = () => {
      return () => "foo"
    }

    const subscriptionA = subscribe(generator, { next: () => {} })
    const subscriptionB = subscribe(generator, { next: () => {} })

    assert.equal(subscriptionA.unsubscribe(), "foo")
    assert.equal(subscriptionB.unsubscribe(), "foo")
  }

  // generator throw, error not subscribed
  {
    const error = new Error("foo")
    const generator = () => {
      throw error
    }

    assert.throws(() => subscribe(generator), (throwValue) => throwValue === error)
  }

  // generator throw, error subscribed
  {
    const error = new Error("foo")
    const generator = () => {
      throw error
    }

    let catchedError
    subscribe(generator, {
      error: (error) => {
        catchedError = error
      },
    })
    assert.equal(catchedError, error)
  }

  // cleanup throw
  {
    const error = new Error("foo")
    const generator = () => {
      return () => {
        throw error
      }
    }

    const subscriptionA = subscribe(generator, { next: () => {}, error: () => {} })

    assert.throws(() => subscriptionA.unsubscribe(), (throwValue) => throwValue === error)
  }

  // next sync
  {
    const generator = ({ next }) => {
      next("foo")
    }

    const calls = []
    subscribe(generator, {
      next: (value) => {
        calls.push(value)
      },
    })
    assert.deepEqual(calls, ["foo"])
  }

  // next async
  {
    const generator = ({ next }) => {
      setTimeout(next, 1, "foo")
    }

    const calls = []
    subscribe(generator, {
      next: (value) => {
        calls.push(value)
      },
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
    assert.deepEqual(calls, ["foo"])
  }

  // done sync
  {
    let uninstallCalled = false
    const generator = ({ done }) => {
      done()
      return () => {
        uninstallCalled = true
      }
    }

    let doneCalled = false
    subscribe(generator, {
      done: () => {
        doneCalled = true
      },
    })
    assert.equal(doneCalled, true)
    assert.equal(uninstallCalled, true)
  }

  // done async
  {
    let uninstallCalled = false
    const generator = ({ done }) => {
      setTimeout(done)
      return () => {
        uninstallCalled = true
      }
    }

    let doneCalled = false
    subscribe(generator, {
      done: () => {
        doneCalled = true
      },
    })
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(doneCalled, true)
    assert.equal(uninstallCalled, true)
  }

  console.log("passed")
}

test()
