System.register([__v__("/js/arrayLikeToArray.nomodule.js")], function (_export, _context) {
  "use strict";

  var arrayLikeToArray;
  function unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
  }
  _export("default", unsupportedIterableToArray);
  return {
    setters: [function (_arrayLikeToArrayArrayLikeToArrayJs) {
      arrayLikeToArray = _arrayLikeToArrayArrayLikeToArrayJs.default;
    }],
    execute: function () {}
  };
});