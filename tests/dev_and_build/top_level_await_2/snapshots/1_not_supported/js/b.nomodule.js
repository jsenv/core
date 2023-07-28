System.register([__v__("/js/a.nomodule.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_aJs) {
      answer = _aJs.answer;
    }],
    execute: function () {
      window.executionOrder.push("before_import_a");

      // eslint-disable-next-line import/first

      window.executionOrder.push("after_import_a");
      console.log(answer);
    }
  };
});