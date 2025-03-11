System.register([], function (_export, _context) {
  "use strict";

  var answer, loadNestedFeature;
  return {
    setters: [],
    execute: function () {
      _export("answer", answer = 42);
      _export("loadNestedFeature", loadNestedFeature = () => {
        return _context.import("/js/nested_feature.nomodule.js");
      });
    }
  };
});