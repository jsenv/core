import arrayWithHoles from "../arrayWithHoles/arrayWithHoles.js"
import iterableToArrayLimit from "../iterableToArrayLimit/iterableToArrayLimit.js"
import unsupportedIterableToArray from "../unsupportedIterableToArray/unsupportedIterableToArray.js"
import nonIterableRest from "../nonIterableRest/nonIterableRest.js"

export default (arr, i) =>
  arrayWithHoles(arr) ||
  iterableToArrayLimit(arr, i) ||
  unsupportedIterableToArray(arr, i) ||
  nonIterableRest()
