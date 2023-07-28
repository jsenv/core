System.register([__v__("/js/file.nomodule.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_fileJs) {
      answer = _fileJs.answer;
    }],
    execute: function () {
      console.log(answer);
    }
  };
});