import { share } from "./share.js"
import { subscribe } from "./subscribe.js"
import assert from "assert"

const test = async () => {
  // called once, cleanup only on last unsubscribe
  {
    let callCount = 0
    const generator = share(({ next }) => {
      callCount++
      next(10)
      return () => "foo"
    })

    const subscriptionA = subscribe(generator)
    const subscriptionB = subscribe(generator)

    assert.equal(callCount, 1)
    assert.equal(subscriptionA.unsubscribe(), undefined)
    assert.equal(subscriptionB.unsubscribe(), "foo")
  }

  // next called on every subscribe, not once unsubscibed
  {
    const generator = share(({ next }) => {
      next(10)
      setTimeout(next, 1, 11)
      return () => "foo"
    })

    const aNextCalls = []
    const subscriptionA = subscribe(generator, {
      next: (value) => {
        aNextCalls.push(value)
      },
    })
    const bNextCalls = []
    const subscriptionB = subscribe(generator, {
      next: (value) => {
        bNextCalls.push(value)
      },
    })

    assert.deepEqual(aNextCalls, [10])
    assert.deepEqual(bNextCalls, [10])
    subscriptionB.unsubscribe()
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(aNextCalls, [10, 11])
    assert.deepEqual(bNextCalls, [10])
    assert.equal(subscriptionA.unsubscribe(), "foo")
  }

  console.log("passed")
}

test()
