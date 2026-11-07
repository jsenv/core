System.register([__v__("/vendors.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_buildVendorsJs) {
      answer = _buildVendorsJs.answer;
    }],
    execute: function () {
      console.log("b.js");
      window.resolveResultPromise(answer);
    }
  };
});