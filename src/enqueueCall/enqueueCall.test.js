import { test } from "@dmail/test"
import assert from "assert"
import { mockExecution } from "micmac"
import { createPromiseAndHooks } from "../promise.js"
import { enqueueCall, enqueueCallByArgs } from "./enqueueCall.js"

const assertPromiseIsPending = (promise) => {
  assert(promise.status === "pending" || promise.status === "resolved")
}

const assertPromiseIsFulfilled = (promise) => {
  assert.equal(promise.status, "fulfilled")
}

const assertPromiseIsRejected = (promise) => {
  assert.equal(promise.status, "rejected")
}

const assertPromiseIsFulfilledWith = (promise, value) => {
  assertPromiseIsFulfilled(promise)
  assert.equal(promise.value, value)
}

const assertPromiseIsRejectedWith = (promise, value) => {
  assertPromiseIsRejected(promise)
  assert.equal(promise.value, value)
}

test(() => {
  mockExecution(({ tick }) => {
    const fn = (value) => value
    const { promise, resolve } = createPromiseAndHooks()
    const returnedPromise = enqueueCall(fn)(promise)

    assertPromiseIsPending(returnedPromise)
    resolve(1)
    tick()
    assertPromiseIsFulfilledWith(returnedPromise, 1)
  })
})

test(() => {
  mockExecution(({ tick }) => {
    const fn = (value) => value
    const { promise, reject } = createPromiseAndHooks()
    const returnedPromise = enqueueCall(fn)(promise)

    assertPromiseIsPending(returnedPromise)
    reject(1)
    tick()
    assertPromiseIsRejectedWith(returnedPromise, 1)
  })
})

// un appel attends la résolution de tout autre appel en cours
test(() => {
  mockExecution(({ tick }) => {
    const debounced = enqueueCall((promise, value) => promise.then(() => value))
    const firstPromise = createPromiseAndHooks()
    const firstCallPromise = debounced(firstPromise.promise, 1)
    const secondPromise = createPromiseAndHooks()
    const secondCallPromise = debounced(secondPromise.promise, 2)

    assertPromiseIsPending(firstCallPromise)
    assertPromiseIsPending(secondCallPromise)
    firstPromise.resolve()
    tick()
    assertPromiseIsFulfilledWith(firstCallPromise, 1)
    assertPromiseIsPending(secondCallPromise)
    secondPromise.resolve()
    tick()
    assertPromiseIsFulfilledWith(secondCallPromise, 2)
  })
})

// un appel atttends la fin de la résolution de tout autre appel ayant les "même" arguments
test(() => {
  mockExecution(({ tick }) => {
    const fn = (promise, value) => promise.then(() => value)
    const debounced = enqueueCallByArgs(fn)

    const firstPromise = createPromiseAndHooks()
    const secondPromise = createPromiseAndHooks()

    const firstCallPromise = debounced(firstPromise.promise, 1)
    const secondCallPromise = debounced(secondPromise.promise, 2)
    const thirdCallPromise = debounced(firstPromise.promise, 3)

    assertPromiseIsPending(firstCallPromise)
    assertPromiseIsPending(secondCallPromise)
    assertPromiseIsPending(thirdCallPromise)
    firstPromise.resolve()
    tick()
    assertPromiseIsFulfilledWith(firstCallPromise, 1)
    assertPromiseIsPending(secondCallPromise)
    assertPromiseIsFulfilledWith(thirdCallPromise, 3)
    secondPromise.resolve()
    tick()
    assertPromiseIsFulfilledWith(secondCallPromise, 2)
  })
})
