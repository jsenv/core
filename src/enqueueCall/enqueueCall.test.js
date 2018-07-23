import { test } from "@dmail/test"
import { createPromiseAndHooks } from "../promise.js"
import { enqueueCall, enqueueCallByArgs } from "./enqueueCall.js"

const assertPromiseIsPending = () => true

const assertPromiseIsResolving = () => true

const assertPromiseIsRejecting = () => true

const assertPromiseWillResolveTo = () => true

const assertPromiseWillRejectTo = () => true

test(() => {
  const fn = (value) => value
  const { promise, resolve } = createPromiseAndHooks()
  const returnedPromise = enqueueCall(fn)(promise)

  assertPromiseIsPending(returnedPromise)
  resolve(1)
  assertPromiseIsResolving(returnedPromise)
  return assertPromiseWillResolveTo(returnedPromise, 1)
})

test(() => {
  const fn = (value) => value
  const { promise, reject } = createPromiseAndHooks()
  const returnedPromise = enqueueCall(fn)(promise)

  assertPromiseIsPending(returnedPromise)
  reject(1)
  assertPromiseIsRejecting(returnedPromise)
  return assertPromiseWillRejectTo(returnedPromise, 1)
})

// un appel attends la résolution de tout autre appel en cours
test(() => {
  const debounced = enqueueCall((promise, value) => promise.then(() => value))
  const firstPromise = createPromiseAndHooks()
  const firstCallPromise = debounced(firstPromise.promise, 1)
  const secondPromise = createPromiseAndHooks()
  const secondCallPromise = debounced(secondPromise.promise, 2)

  assertPromiseIsPending(firstCallPromise)
  assertPromiseIsPending(secondCallPromise)
  firstPromise.resolve()
  assertPromiseIsResolving(firstCallPromise)
  assertPromiseIsPending(secondCallPromise)
  return assertPromiseWillResolveTo(firstCallPromise, 1).then(() => {
    secondPromise.resolve()
    assertPromiseIsResolving(secondCallPromise)
    return assertPromiseWillResolveTo(secondCallPromise, 2)
  })
})

// un appel atttends la fin de la résolution de tout autre appel ayant les "même" arguments
test(() => {
  const map = new Map()
  const restoreByArgs = (value) => map.get(value)
  const memoizeArgs = (fn, value) => map.set(value, fn)
  const fn = (promise, value) => promise.then(() => value)
  const debounced = enqueueCallByArgs({ fn, restoreByArgs, memoizeArgs })

  const firstPromise = createPromiseAndHooks()
  const secondPromise = createPromiseAndHooks()

  const firstCallPromise = debounced(firstPromise.promise, 1)
  const secondCallPromise = debounced(secondPromise.promise, 2)
  const thirdCallPromise = debounced(firstPromise.promise, 3)

  assertPromiseIsPending(firstCallPromise)
  assertPromiseIsPending(secondCallPromise)
  assertPromiseIsPending(thirdCallPromise)
  firstPromise.resolve()
  assertPromiseIsResolving(firstCallPromise)
  return assertPromiseWillResolveTo(firstCallPromise, 1).then(() => {
    assertPromiseIsPending(secondCallPromise)
    assertPromiseIsResolving(thirdCallPromise)
    return assertPromiseWillResolveTo(thirdCallPromise, 3).then(() => {
      secondPromise.resolve()
      assertPromiseIsResolving(secondCallPromise)
      return assertPromiseWillResolveTo(secondCallPromise, 2)
    })
  })
})
