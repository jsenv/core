import wrapNativeSuper from "../wrapNativeSuper/wrapNativeSuper.js"
import inherits from "../inherits/inherits.js"

var _super = RegExp.prototype
var _RegExp = wrapNativeSuper(RegExp)
var _groups = new WeakMap()

function BabelRegExp(re, flags, groups) {
  var _this = _RegExp.call(this, re, flags)
  // if the regex is recreated with 'g' flag
  _groups.set(_this, groups || _groups.get(re))
  return _this
}
inherits(BabelRegExp, _RegExp)
BabelRegExp.prototype.exec = function (str) {
  var result = _super.exec.call(this, str)
  if (result) result.groups = buildGroups(result, this)
  return result
}
BabelRegExp.prototype[Symbol.replace] = function (str, substitution) {
  if (typeof substitution === "string") {
    var groups = _groups.get(this)
    return _super[Symbol.replace].call(
      this,
      str,
      substitution.replace(/\\$<([^>]+)>/g, function (_, name) {
        return `$${groups[name]}`
      }),
    )
  } else if (typeof substitution === "function") {
    var _this = this
    return _super[Symbol.replace].call(this, str, function () {
      var args = []
      // eslint-disable-next-line prefer-spread,  prefer-rest-params
      args.push.apply(args, arguments)
      if (typeof args[args.length - 1] !== "object") {
        // Modern engines already pass result.groups as the last arg.
        args.push(buildGroups(args, _this))
      }
      return substitution.apply(this, args)
    })
  }
  return _super[Symbol.replace].call(this, str, substitution)
}
function buildGroups(result, re) {
  // NOTE: This function should return undefined if there are no groups,
  // but in that case Babel doesn't add the wrapper anyway.
  var g = _groups.get(re)
  return Object.keys(g).reduce(function (groups, name) {
    groups[name] = result[g[name]]
    return groups
  }, Object.create(null))
}

export default function (re, groups) {
  return new BabelRegExp(re, undefined, groups)
}
