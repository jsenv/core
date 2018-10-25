import {
  promiseConcurrent,
  reduceToFirstOrPending,
  millisecondToResolved,
  mapPending,
} from "./promiseHelper.js"
import assert from "assert"

promiseConcurrent([0, 1, 2, 3, 4], (a) => a + 1, { maxParallelExecution: 2 }).then((actual) => {
  const expected = [1, 2, 3, 4, 5]
  assert.deepEqual(actual, expected)
})

promiseConcurrent([0, 1], (a) => a + 1, { maxParallelExecution: 3 }).then((actual) => {
  const expected = [1, 2]
  assert.deepEqual(actual, expected)
})

reduceToFirstOrPending(["foo", millisecondToResolved(1)]).then((value) => {
  assert.equal(value, "foo")
})

reduceToFirstOrPending([10, 11]).then(() => {
  assert.fail("must be pending")
})

reduceToFirstOrPending([
  Promise.reject("foo"),
  millisecondToResolved(1).then(() => Promise.reject("bar")),
]).catch((error) => {
  assert.equal(error, "foo")
})

mapPending(millisecondToResolved(1), () => false).then((value) => {
  assert.equal(value, false)
})

mapPending(Promise.resolve(true), () => false).then((value) => {
  assert.equal(value, true)
})

mapPending(true, () => false).then((value) => {
  assert.equal(value, true)
})
