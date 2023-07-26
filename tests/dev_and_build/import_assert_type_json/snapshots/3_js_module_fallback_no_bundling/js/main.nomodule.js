System.register([__v__("/js/data.nomodule.js")], function (_export, _context) {
  "use strict";

  var data;
  return {
    setters: [function (_) {
      data = _.default;
    }],
    execute: function () {
      window.resolveResultPromise({
        data
      });
    }
  };
});