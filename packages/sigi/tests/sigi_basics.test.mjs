/*
a faire:
- renommer un peu tout pour clarifier de quoi on parle
(object vs property)
- s'assurer que le state passer a sigi est mis a jour par mutate()
to test:
- try to set, define, delete property on state (it must throw)
*/

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
