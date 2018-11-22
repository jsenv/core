import { test } from "@dmail/test"
import assert from "assert"
import { mockExecution } from "micmac"
import { createPromiseAndHooks } from "../promiseHelper.js"
import { createLockRegistry } from "./createLock.js"

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
    const lock = createLockRegistry().lockForRessource()
    const promise = createPromiseAndHooks()
    const returnedPromise = lock.chain(() => promise)

    assertPromiseIsPending(returnedPromise)
    promise.resolve(1)
    tick()
    assertPromiseIsFulfilledWith(returnedPromise, 1)
  })
})

test(() => {
  mockExecution(({ tick }) => {
    const lock = createLockRegistry().lockForRessource()
    const promise = createPromiseAndHooks()
    const returnedPromise = lock.chain(() => promise)

    assertPromiseIsPending(returnedPromise)
    promise.reject(1)
    tick()
    assertPromiseIsRejectedWith(returnedPromise, 1)
  })
})

// un appel attends la résolution de tout autre appel en cours
test(() => {
  mockExecution(({ tick }) => {
    const lock = createLockRegistry().lockForRessource()
    const firstPromise = createPromiseAndHooks()
    const firstCallPromise = lock.chain(() => firstPromise.then(() => 1))
    const secondPromise = createPromiseAndHooks()
    const secondCallPromise = lock.chain(() => secondPromise.then(() => 2))

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
    const registry = createLockRegistry()
    const lock1 = registry.lockForRessource(1)
    const lock2 = registry.lockForRessource(2)

    const firstPromise = createPromiseAndHooks()
    const secondPromise = createPromiseAndHooks()

    const firstCallPromise = lock1.chain(() => firstPromise)
    const secondCallPromise = lock2.chain(() => secondPromise)
    const thirdCallPromise = lock1.chain(() => firstPromise)

    assertPromiseIsPending(firstCallPromise)
    assertPromiseIsPending(secondCallPromise)
    assertPromiseIsPending(thirdCallPromise)
    firstPromise.resolve(1)
    tick()
    assertPromiseIsFulfilledWith(firstCallPromise, 1)
    assertPromiseIsPending(secondCallPromise)
    assertPromiseIsFulfilledWith(thirdCallPromise, 1)
    secondPromise.resolve(2)
    tick()
    assertPromiseIsFulfilledWith(secondCallPromise, 2)
  })
})
