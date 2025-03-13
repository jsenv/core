System.register([__v__("/vendors.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_snapshots2_vendors_and_js_module_fallbackVendorsJs) {
      answer = _snapshots2_vendors_and_js_module_fallbackVendorsJs.answer;
    }],
    execute: function () {
      window.resolveResultPromise(answer);
    }
  };
});