System.register([__v__("/js/file.nomodule.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_clientFileJs) {
      answer = _clientFileJs.answer;
    }],
    execute: function () {
      console.log(answer);
      window.resolveResultPromise(answer);
    }
  };
});