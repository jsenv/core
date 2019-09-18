export default function(obj, descs) {
  // eslint-disable-next-line guard-for-in
  for (var key in descs) {
    var desc = descs[key]
    desc.configurable = desc.enumerable = true
    if ("value" in desc) desc.writable = true
    Object.defineProperty(obj, key, desc)
  }
  // Symbols are not enumerated over by for-in loops. If native
  // Symbols are available, fetch all of the descs object's own
  // symbol properties and define them on our target object too.
  if (Object.getOwnPropertySymbols) {
    var objectSymbols = Object.getOwnPropertySymbols(descs)
    for (var i = 0; i < objectSymbols.length; i++) {
      var sym = objectSymbols[i]
      var symbDesc = descs[sym]
      symbDesc.configurable = symbDesc.enumerable = true
      if ("value" in symbDesc) symbDesc.writable = true
      Object.defineProperty(obj, sym, symbDesc)
    }
  }
  return obj
}
