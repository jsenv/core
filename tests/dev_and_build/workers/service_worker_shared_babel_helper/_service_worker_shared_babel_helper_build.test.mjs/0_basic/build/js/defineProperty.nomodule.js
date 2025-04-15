System.register([__v__("/js/toPropertyKey.nomodule.js")], function (_export, _context) {
  "use strict";

  var toPropertyKey;
  return {
    setters: [function (_toPropertyKeyToPropertyKeyJs) {
      toPropertyKey = _toPropertyKeyToPropertyKeyJs.default;
    }],
    execute: function () {
      _export("default", (obj, key, value) => {
        key = toPropertyKey(key);
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      });
    }
  };
});