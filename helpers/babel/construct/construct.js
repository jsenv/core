import setPrototypeOf from "../setPrototypeOf/setPrototypeOf.js"

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

function isNativeReflectConstruct() {
  if (typeof Reflect === "undefined" || !Reflect.construct) return false
  // core-js@3
  if (Reflect.construct.sham) return false
  // Proxy can't be polyfilled. Every browser implemented
  // proxies before or at the same time as Reflect.construct,
  // so if they support Proxy they also support Reflect.construct.
  if (typeof Proxy === "function") return true
  // Since Reflect.construct can't be properly polyfilled, some
  // implementations (e.g. core-js@2) don't set the correct internal slots.
  // Those polyfills don't allow us to subclass built-ins, so we need to
  // use our fallback implementation.
  try {
    // If the internal slots aren't set, this throws an error similar to
    //   TypeError: this is not a Date object.
    Date.prototype.toString.call(Reflect.construct(Date, [], function() {}))
    return true
  } catch (e) {
    return false
  }
}

export default isNativeReflectConstruct() ? Reflect.construct : reflectConstruct
