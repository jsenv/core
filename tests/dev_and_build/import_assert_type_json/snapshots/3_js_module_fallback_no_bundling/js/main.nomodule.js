System.register([__v__("/js/data.json.nomodule.js")], function (_export, _context) {
  "use strict";

  var data;
  return {
    setters: [function (_dataJsonAs_json_module) {
      data = _dataJsonAs_json_module.default;
    }],
    execute: function () {
      window.resolveResultPromise({
        data
      });
    }
  };
});