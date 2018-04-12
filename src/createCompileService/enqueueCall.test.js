import { enqueueCall, enqueueCallByArgs } from "./enqueueCall.js"
import { test } from "@dmail/test"
import { createAction } from "@dmail/action"
import assert from "assert"

const isPassed = (action) => action.getState() === "passed"

const isFailed = (action) => action.getState() === "failed"

test(() => {
  const fn = (value) => value
  const action = createAction()
  const returnedAction = enqueueCall(fn)(action)

  assert.equal(isPassed(returnedAction), false)
  action.pass(1)
  assert.equal(isPassed(returnedAction), true)
  assert.equal(returnedAction.getResult(), 1)
})

test(() => {
  const fn = (value) => value
  const action = createAction()
  const returnedAction = enqueueCall(fn)(action)

  assert.equal(isFailed(returnedAction), false)
  action.fail(1)
  assert.equal(isFailed(returnedAction), true)
  assert.equal(returnedAction.getResult(), 1)
})

// un appel attends la résolution de tout autre appel en cours
test(() => {
  const debounced = enqueueCall((action, value) => action.then(() => value))
  const firstAction = createAction()
  const firstCallAction = debounced(firstAction, 1)
  const secondAction = createAction()
  const secondCallAction = debounced(secondAction, 2)

  assert.equal(isPassed(firstCallAction), false)
  assert.equal(isPassed(secondCallAction), false)
  firstAction.pass()
  assert.equal(isPassed(firstCallAction), true)
  assert.equal(firstCallAction.getResult(), 1)
  assert.equal(isPassed(secondCallAction), false)
  secondAction.pass()
  assert.equal(isPassed(secondCallAction), true)
  assert.equal(secondCallAction.getResult(), 2)
})

// un appel atttends la fin de la résolution de tout autre appel ayant les "même" arguments
test(() => {
  const map = new Map()
  const restoreByArgs = (value) => map.get(value)
  const memoizeArgs = (fn, value) => map.set(value, fn)
  const fn = (action, value) => action.then(() => value)
  const debounced = enqueueCallByArgs({ fn, restoreByArgs, memoizeArgs })

  const firstAction = createAction()
  const secondAction = createAction()

  const firstCallAction = debounced(firstAction, 1)
  const secondCallAction = debounced(secondAction, 2)
  const thirdCallAction = debounced(firstAction, 3)

  assert.equal(isPassed(firstCallAction), false)
  assert.equal(isPassed(secondCallAction), false)
  assert.equal(isPassed(thirdCallAction), false)
  firstAction.pass()
  assert.equal(isPassed(firstCallAction), true)
  assert.equal(firstCallAction.getResult(), 1)
  assert.equal(isPassed(secondCallAction), false)
  assert.equal(isPassed(thirdCallAction), true)
  assert.equal(thirdCallAction.getResult(), 3)
  secondAction.pass()
  assert.equal(isPassed(secondCallAction), true)
  assert.equal(secondCallAction.getResult(), 2)
})
