System.register([__v__("/js/answer.nomodule.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_clientAnswerJs) {
      answer = _clientAnswerJs.answer;
    }],
    execute: function () {
      console.log(`a: ${answer}`);
      window.a = answer;
    }
  };
});