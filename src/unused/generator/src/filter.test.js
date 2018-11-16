import { filter } from "./filter.js"
import { subscribe } from "./subscribe.js"
import assert from "assert"

const test = async () => {
  {
    let installed = false
    const generator = ({ next }) => {
      installed = true
      next(10)
      next(20)
      return () => {
        installed = false
      }
    }
    const filtered = filter(generator, (a) => a === 20)

    assert.equal(installed, false)
    const nextCalls = []
    subscribe(filtered, {
      next: (value) => {
        nextCalls.push(value)
      },
    })
    assert.deepEqual(nextCalls, [20])
  }

  console.log("passed")
}

test()
