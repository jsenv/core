System.register([__v__("/js/toPrimitive.nomodule.js")], function (_export, _context) {
  "use strict";

  var toPrimitive;
  _export("default", function (arg) {
    var key = toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
  });
  return {
    setters: [function (_toPrimitiveToPrimitiveJs) {
      toPrimitive = _toPrimitiveToPrimitiveJs.default;
    }],
    execute: function () {}
  };
});