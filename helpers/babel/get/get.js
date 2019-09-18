import superPropBase from "../superPropBase/superPropBase.js"

function reflectGet(target, property, receiver) {
  var base = superPropBase(target, property)
  if (!base) return undefined
  var desc = Object.getOwnPropertyDescriptor(base, property)
  if (desc.get) {
    return desc.get.call(receiver)
  }
  return desc.value
}

export default typeof Reflect !== "undefined" && Reflect.get ? Reflect.get : reflectGet
