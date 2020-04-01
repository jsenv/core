import setPrototypeOf from "../setPrototypeOf/setPrototypeOf.js"
import isNativeReflectConstruct from "../isNativeReflectConstruct/isNativeReflectConstruct.js"

// NOTE: If Parent !== Class, the correct __proto__ is set *after*
// calling the constructor.
function reflectConstruct(Parent, args, Class) {
  var a = [null]
  // eslint-disable-next-line prefer-spread
  a.push.apply(a, args)
  var Constructor = Function.bind.apply(Parent, a)
  var instance = new Constructor()
  if (Class) setPrototypeOf(instance, Class.prototype)
  return instance
}

export default isNativeReflectConstruct() ? Reflect.construct : reflectConstruct
