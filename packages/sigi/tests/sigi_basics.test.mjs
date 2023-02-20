import { assert } from "@jsenv/assert"
import { sigi } from "@jsenv/sigi"

// state nested prop can be read
{
  const { state } = sigi({
    foo: true,
    nested: {
      name: "yes",
    },
  })
  const actual = state.nested.name
  const expected = "yes"
  assert({ actual, expected })
}

// from primitive to object
{
  const { mutate, subscribe } = sigi({
    foo: null,
  })
  const calls = []
  subscribe(({ foo }) => {
    if (foo) {
      calls.push(foo.version)
    } else {
      calls.push(foo)
    }
  })
  const callsBeforeMutate = calls.slice()
  mutate({ foo: { version: 1 } })
  const callsAfterMutate = calls.slice()
  const actual = {
    callsBeforeMutate,
    callsAfterMutate,
  }
  const expected = {
    callsBeforeMutate: [null],
    callsAfterMutate: [null, 1],
  }
  assert({ actual, expected })
}

// from object to primitive
{
  const { mutate, subscribe } = sigi({
    foo: { version: 1 },
  })
  const calls = []
  subscribe(({ foo }) => {
    if (foo) {
      calls.push(foo.version)
    } else {
      calls.push(foo)
    }
  })
  const callsBeforeMutate = calls.slice()
  mutate({ foo: null })
  const callsAfterMutate = calls.slice()
  const actual = {
    callsBeforeMutate,
    callsAfterMutate,
  }
  const expected = {
    callsBeforeMutate: [1],
    callsAfterMutate: [1, null],
  }
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

// array are primitives
// it means you cannot update one item of the array
// the entire array is watched as a primitive (like a string/number/boolean,...)
{
  const { subscribe, mutate } = sigi({ users: ["a", "b"] })
  const calls = []
  subscribe(({ users }) => {
    calls.push(users)
  })
  mutate({ users: ["a", "b", "c"] })
  const actual = calls
  const expected = [
    ["a", "b"],
    ["a", "b", "c"],
  ]
  assert({ actual, expected })
}

// reading non existent prop twice
{
  const { state } = sigi({
    foo: true,
  })
  const values = []
  values.push(state.value)
  values.push(state.value)
  const actual = values
  const expected = [undefined, undefined]
  assert({ actual, expected })
}

// throw if attempt to set prop
{
  const { state } = sigi({ foo: true })
  try {
    state.foo = false
    throw new Error("should throw")
  } catch (e) {
    const actual = e
    const expected = new Error(
      `Invalid attempt to set "foo", cannot mutate state from outside`,
    )
    assert({ actual, expected })
  }
}

// throw if attempt to delete prop
{
  const { state } = sigi({ foo: true })
  try {
    delete state.foo
    throw new Error("should throw")
  } catch (e) {
    const actual = e
    const expected = new Error(
      `Invalid attempt to delete "foo", cannot mutate state from outside`,
    )
    assert({ actual, expected })
  }
}

// throw if attempt to define prop
{
  const { state } = sigi({ foo: true })
  try {
    Object.defineProperty(state, "foo", {
      value: false,
    })
    throw new Error("should throw")
  } catch (e) {
    const actual = e
    const expected = new Error(
      `Invalid attempt to define "foo", cannot mutate state from outside`,
    )
    assert({ actual, expected })
  }
}

// original state kept in sync by mutate
// -- TO KEEP IN MIND WHEN USING ORIGINAL STATE ---
// Can be used to read state but not to write (use mutate for that)
// Trying to write on original state would not call subscribers
{
  const originalState = { nested: { foo: true } }
  const originalNested = originalState.nested
  const { mutate } = sigi(originalState)
  mutate({ nested: { foo: false } })
  const nestedPreserved = originalNested === originalState.nested
  const foo = originalState.nested.foo
  const actual = {
    nestedPreserved,
    foo,
  }
  const expected = {
    nestedPreserved: true,
    foo: false,
  }
  assert({ actual, expected })
}
