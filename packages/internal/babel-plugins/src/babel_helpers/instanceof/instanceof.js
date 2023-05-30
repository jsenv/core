export default function (left, right) {
  if (right !== null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
    return Boolean(right[Symbol.hasInstance](left))
  }
  return left instanceof right
}
