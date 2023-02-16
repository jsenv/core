import { assert } from "@jsenv/assert"
import { sigi } from "@jsenv/sigi"

// state nested prop can be read
{
  const { state } = sigi({
    nested: {
      name: "yes",
    },
  })
  const actual = state.nested.name
  const expected = "yes"
  assert({ actual, expected })
}

// can subscribe to top level changes
{
  const { mutate, subscribe } = sigi({ age: 10 })
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

// subscribe callback not called when something else changes
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

// can subscribe to nested changes
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

// // preventExtensions is respected
// {
//   const { mutate } = sigi(Object.preventExtensions({ foo: true }))
//   try {
//     mutate({ bar: true })
//     throw new Error("should throw")
//   } catch (e) {
//     const actual = e
//     const expected = new TypeError(
//       `Cannot define property bar, object is not extensible`,
//     )
//     assert({ actual, expected })
//   }
// }

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

// extending root state with mutate
{
  const { mutate, subscribe } = sigi({
    foo: true,
  })
  const calls = []
  subscribe(({ bar }) => {
    calls.push(bar)
  })
  const callsBeforeMutate = calls.slice()
  mutate({ bar: "a" })
  const callsAfterMutate = calls.slice()
  mutate({ bar: "b" })
  const callsAfterSecondMutate = calls.slice()
  const actual = {
    callsBeforeMutate,
    callsAfterMutate,
    callsAfterSecondMutate,
  }
  const expected = {
    callsBeforeMutate: [undefined],
    callsAfterMutate: [undefined, "a"],
    callsAfterSecondMutate: [undefined, "a", "b"],
  }
  assert({ actual, expected })
}
