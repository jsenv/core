System.register([__v__("/js/vendors.nomodule.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_vendorsJs) {
      answer = _vendorsJs.answer;
    }],
    execute: function () {
      console.log("b.js");
      window.resolveResultPromise(answer);
    }
  };
});