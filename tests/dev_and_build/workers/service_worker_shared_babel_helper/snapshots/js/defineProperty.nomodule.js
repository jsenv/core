System.register([__v__("/js/toPropertyKey.nomodule.js")], function (_export, _context) {
  "use strict";

  var toPropertyKey;
  return {
    setters: [function (_packagesInternalPluginTranspilationSrcBabelBabel_helper_directoryBabel_helpersToPropertyKeyToPropertyKeyJs) {
      toPropertyKey = _packagesInternalPluginTranspilationSrcBabelBabel_helper_directoryBabel_helpersToPropertyKeyToPropertyKeyJs.default;
    }],
    execute: function () {
      _export("default", (obj, key, value) => {
        key = toPropertyKey(key);
        // Shortcircuit the slow defineProperty path when possible.
        // We are trying to avoid issues where setters defined on the
        // prototype cause side effects under the fast path of simple
        // assignment. By checking for existence of the property with
        // the in operator, we can optimize most of this overhead away.
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