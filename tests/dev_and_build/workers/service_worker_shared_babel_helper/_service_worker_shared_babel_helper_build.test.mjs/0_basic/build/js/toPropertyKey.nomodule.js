System.register([__v__("/js/toPrimitive.nomodule.js")], function (_export, _context) {
  "use strict";

  var toPrimitive;
  function toPropertyKey(arg) {
    var key = toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
  }
  _export("default", toPropertyKey);
  return {
    setters: [function (_toPrimitiveToPrimitiveJs) {
      toPrimitive = _toPrimitiveToPrimitiveJs.default;
    }],
    execute: function () {}
  };
});