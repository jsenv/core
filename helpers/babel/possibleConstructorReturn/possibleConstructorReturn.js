import assertThisInitialized from "../assertThisInitialized/assertThisInitialized.js"

export default (self, call) => {
  if (call && (typeof call === "object" || typeof call === "function")) {
    return call
  } else if (call !== void 0) {
    throw new TypeError("Derived constructors may only return object or undefined")
  }
  return assertThisInitialized(self)
}
