System.register([__v__("/js/objectSpread2.nomodule.js"), __v__("/js/slicedToArray.nomodule.js")], function (_export, _context) {
  "use strict";

  var _objectSpread, _slicedToArray, getResponse, _getResponse, _getResponse2, answer;
  return {
    setters: [function (_packagesInternalPluginTranspilationSrcBabelBabel_helper_directoryBabel_helpersObjectSpread2ObjectSpread2Js) {
      _objectSpread = _packagesInternalPluginTranspilationSrcBabelBabel_helper_directoryBabel_helpersObjectSpread2ObjectSpread2Js.default;
    }, function (_packagesInternalPluginTranspilationSrcBabelBabel_helper_directoryBabel_helpersSlicedToArraySlicedToArrayJs) {
      _slicedToArray = _packagesInternalPluginTranspilationSrcBabelBabel_helper_directoryBabel_helpersSlicedToArraySlicedToArrayJs.default;
    }],
    execute: function () {
      _context.import(__v__("/js/app.nomodule.js"));
      getResponse = () => {
        return [42];
      };
      _getResponse = getResponse();
      _getResponse2 = _slicedToArray(_getResponse, 1);
      answer = _getResponse2[0];
      console.log(_objectSpread({}, {
        answer
      }));
      window.resolveResultPromise({
        answer: 42
      });
    }
  };
});