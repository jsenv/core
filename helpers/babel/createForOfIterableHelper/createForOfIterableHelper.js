/* eslint-disable eqeqeq, no-eq-null */
import unsupportedIterableToArray from "../unsupportedIterableToArray/unsupportedIterableToArray.js"

// s: start (create the iterator)
// n: next
// e: error (called whenever something throws)
// f: finish (always called at the end)
export default function createForOfIteratorHelper(o) {
  if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) {
    // Fallback for engines without symbol support
    if (Array.isArray(o) || (o = unsupportedIterableToArray(o))) {
      var i = 0
      var F = function () {}
      return {
        s: F,
        n() {
          if (i >= o.length) return { done: true }
          return { done: false, value: o[i++] }
        },
        e(e) {
          throw e
        },
        f: F,
      }
    }
    throw new TypeError(
      "Invalid attempt to iterate non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.",
    )
  }
  var it
  var normalCompletion = true
  var didErr = false
  var err
  return {
    s() {
      it = o[Symbol.iterator]()
    },
    n() {
      var step = it.next()
      normalCompletion = step.done
      return step
    },
    e(e) {
      didErr = true
      err = e
    },
    f() {
      try {
        if (!normalCompletion && it.return != null) it.return()
      } finally {
        if (didErr) throw err
      }
    },
  }
}
