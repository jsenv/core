import { assert } from "@jsenv/assert"
import { createStructuredStateManager, onChange } from "@jsenv/state"

// callback is called right away and when property changes
{
  const state = createStructuredStateManager({ age: 10 })
  const calls = []
  onChange(state, ({ age }) => {
    calls.push(age)
  })
  const callsBeforeUpdate = calls.slice()
  state.age = 20
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
  const state = createStructuredStateManager({ age: 10 })
  const calls = []
  onChange(state, ({ age }) => {
    calls.push(age)
  })
  const callsBeforeUpdate = calls.slice()
  state.color = "blue"
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
  const state = createStructuredStateManager({ nested: { color: "blue" } })
  const calls = []
  onChange(state, ({ nested }) => {
    calls.push(nested.color)
  })
  const callsBeforeUpdate = calls.slice()
  state.nested.color = "red"
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

// works too if we redefine nested entirely
{
  const state = createStructuredStateManager({ nested: { color: "blue" } })
  const calls = []
  onChange(state, ({ nested }) => {
    calls.push(nested.color)
  })
  const callsBeforeUpdate = calls.slice()
  state.nested = { color: "red" }
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
