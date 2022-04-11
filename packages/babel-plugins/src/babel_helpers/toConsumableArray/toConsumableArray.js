import arrayWithoutHoles from "../arrayWithoutHoles/arrayWithoutHoles.js"
import iterableToArray from "../iterableToArray/iterableToArray.js"
import unsupportedIterableToArray from "../unsupportedIterableToArray/unsupportedIterableToArray.js"
import nonIterableSpread from "../nonIterableSpread/nonIterableSpread.js"

export default (arr) =>
  arrayWithoutHoles(arr) ||
  iterableToArray(arr) ||
  unsupportedIterableToArray(arr) ||
  nonIterableSpread()
