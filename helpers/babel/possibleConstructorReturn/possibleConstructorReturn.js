import assertThisInitialized from "../assertThisInitialized/assertThisInitialized.js"

export default (self, call) => {
  if (call && (typeof call === "object" || typeof call === "function")) {
    return call
  }
  return assertThisInitialized(self)
}
