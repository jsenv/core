System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      window.ask = async () => {
        const {
          answer
        } = await _context.import(__v__("/js/dep.nomodule.js"));
        return answer;
      };
    }
  };
});