export default function (input, hint /* : "default" | "string" | "number" | void */) {
  if (typeof input !== "object" || input === null) return input
  var prim = input[Symbol.toPrimitive]
  if (prim !== undefined) {
    var res = prim.call(input, hint || "default")
    if (typeof res !== "object") return res
    throw new TypeError("@@toPrimitive must return a primitive value.")
  }
  return (hint === "string" ? String : Number)(input)
}
