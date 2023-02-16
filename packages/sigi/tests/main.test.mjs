import { assert } from "@jsenv/assert"
import { sigi } from "@jsenv/sigi"

// callback is called right away and when property changes
{
  const { mutate, subscribe } = sigi({ age: 10 }, { debug: true })
  const calls = []
  subscribe(({ age }) => {
    calls.push(age)
  })
  const callsBeforeUpdate = calls.slice()
  mutate({ age: 20 })
  const callsAfterUpdate = calls.slice()
  const actual = {
    callsBeforeUpdate,
    callsAfterUpdate,
  }
  const expected = {
    callsBeforeUpdate: [10],
    callsAfterUpdate: [10, 20],
  }
  assert({ actual, expected })
}

// callbacks are called only if they access a property that has changed
{
  const { subscribe, mutate } = sigi({ age: 10 })
  const calls = []
  subscribe(({ age }) => {
    calls.push(age)
  })
  const callsBeforeUpdate = calls.slice()
  mutate({ color: "blue" })
  const callsAfterUpdate = calls.slice()
  const actual = {
    callsBeforeUpdate,
    callsAfterUpdate,
  }
  const expected = {
    callsBeforeUpdate: [10],
    callsAfterUpdate: [10],
  }
  assert({ actual, expected })
}

// it works with nested properties
{
  const { subscribe, mutate } = sigi({ nested: { color: "blue" } })
  const calls = []
  subscribe(({ nested }) => {
    calls.push(nested.color)
  })
  const callsBeforeUpdate = calls.slice()
  mutate({ nested: { color: "red" } })
  const callsAfterUpdate = calls.slice()
  const actual = {
    callsBeforeUpdate,
    callsAfterUpdate,
  }
  const expected = {
    callsBeforeUpdate: ["blue"],
    callsAfterUpdate: ["blue", "red"],
  }
  assert({ actual, expected })
}

// preventExtensions is respected
{
  const { mutate } = sigi(Object.preventExtensions({ foo: true }))
  try {
    mutate({ bar: true })
    throw new Error("should throw")
  } catch (e) {
    const actual = e
    const expected = new TypeError(
      `Cannot add property bar, object is not extensible`,
    )
    assert({ actual, expected })
  }
}

// warning when mutate changes the type
{
  const consoleWarnings = []
  const { warn } = console
  console.warn = (warning) => {
    consoleWarnings.push(warning)
  }
  try {
    const { mutate } = sigi({ isLogged: true })
    mutate({ isLogged: 1 })
    const actual = consoleWarnings
    const expected = [
      `A value type will change from "boolean" to "number" at state.isLogged`,
    ]
    assert({ actual, expected })
  } finally {
    console.warn = warn
  }
}
