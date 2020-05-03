import arrayWithHoles from "../arrayWithHoles/arrayWithHoles.js"
import iterableToArrayLimitLoose from "../iterableToArrayLimitLoose/iterableToArrayLimitLoose.js"
import unsupportedIterableToArray from "../unsupportedIterableToArray/unsupportedIterableToArray.js"
import nonIterableRest from "../nonIterableRest/nonIterableRest.js"

export default function (arr, i) {
  return (
    arrayWithHoles(arr) ||
    iterableToArrayLimitLoose(arr, i) ||
    unsupportedIterableToArray(arr, i) ||
    nonIterableRest()
  )
}
