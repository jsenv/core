import { map } from "./map.js"
import { subscribe } from "./subscribe.js"
import assert from "assert"

const test = async () => {
  {
    let installed = false
    const generator = ({ next }) => {
      installed = true
      next(10)
      return () => {
        installed = false
      }
    }
    const mapped = map(generator, (a) => a * 2)

    assert.equal(installed, false)
    let nextCalledWith
    subscribe(mapped, {
      next: (value) => {
        nextCalledWith = value
      },
    })
    assert.equal(nextCalledWith, 20)
  }

  console.log("passed")
}

test()
