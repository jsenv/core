System.register([__v__("/js/util.nomodule.js")], function (_export, _context) {
  "use strict";

  var util, answer;
  return {
    setters: [function (_utilJs) {
      util = _utilJs.util;
    }],
    execute: function () {
      util();
      console.log("Hello world");
      _export("answer", answer = 42);
    }
  };
});