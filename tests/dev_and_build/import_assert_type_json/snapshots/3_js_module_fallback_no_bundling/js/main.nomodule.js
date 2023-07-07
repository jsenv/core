System.register([__v__("/js/data.nomodule.js")], function (_export, _context) {
  "use strict";

  var data;
  return {
    setters: [function (_clientDataJsonAs_json_module) {
      data = _clientDataJsonAs_json_module.default;
    }],
    execute: function () {
      window.resolveResultPromise({
        data
      });
    }
  };
});