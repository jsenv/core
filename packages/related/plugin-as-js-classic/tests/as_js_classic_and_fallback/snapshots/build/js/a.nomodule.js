System.register([__v__("/js/answer.nomodule.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_answerJs) {
      answer = _answerJs.answer;
    }],
    execute: function () {
      console.log(`a: ${answer}`);
      window.resolveAPromise(answer);
    }
  };
});