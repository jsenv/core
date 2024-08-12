System.register([], function (_export, _context) {
  "use strict";

  var loadFeature;
  return {
    setters: [],
    execute: function () {
      _export("loadFeature", loadFeature = async () => {
        const {
          answer,
          loadNestedFeature
        } = await _context.import("/js/feature.nomodule.js");
        loadNestedFeature();
        debugger;
        console.log(answer);
      });
    }
  };
});