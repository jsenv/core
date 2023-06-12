System.register([__v__("/js/util.nomodule.js")], function (_export, _context) {
  "use strict";

  var util, answer;
  return {
    setters: [function (_clientSrcUtilJs) {
      util = _clientSrcUtilJs.util;
    }],
    execute: function () {
      util();
      console.log("Hello world");
      _export("answer", answer = 42);
    }
  };
});
//# sourceMappingURL=../../.jsenv/postbuild/js/main.nomodule.js.map
