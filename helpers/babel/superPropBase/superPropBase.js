import getPrototypeOf from "../getPrototypeOf/getPrototypeOf.js"

export default function (object, property) {
  // Yes, this throws if object is null to being with, that's on purpose.
  while (!Object.prototype.hasOwnProperty.call(object, property)) {
    object = getPrototypeOf(object)
    if (object === null) break
  }
  return object
}
