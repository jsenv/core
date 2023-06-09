import arrayLikeToArray from "../arrayLikeToArray/arrayLikeToArray.js"

export default function _maybeArrayLike(next, arr, i) {
  if (arr && !Array.isArray(arr) && typeof arr.length === "number") {
    var len = arr.length
    // eslint-disable-next-line no-void
    return arrayLikeToArray(arr, i !== void 0 && i < len ? i : len)
  }
  return next(arr, i)
}
