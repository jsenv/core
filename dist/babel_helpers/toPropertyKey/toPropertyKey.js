import toPrimitive from "../toPrimitive/toPrimitive.js"

export default function (arg) {
  var key = toPrimitive(arg, "string")
  return typeof key === "symbol" ? key : String(key)
}
