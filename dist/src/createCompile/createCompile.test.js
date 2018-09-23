"use strict";

var _createCompile = require("./createCompile.js");

var _instrumenterBabel = require("./instrumenter-babel.js");

var _istanbul = require("istanbul");

var _istanbul2 = _interopRequireDefault(_istanbul);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var compile = (0, _createCompile.createCompile)({
  instrumenter: _instrumenterBabel.instrumenter,
  createOptions: function createOptions() {
    return {
      transpile: true,
      instrument: true,
      remapMethod: "comment"
    };
  }
});

var projectRoot = _path2["default"].resolve(__dirname, "../../../");
var filename = projectRoot + "/src/createCompile/file.js";

compile({
  rootLocation: projectRoot,
  filename: filename,
  inputRelativeLocation: "src/createCompile/file.js",
  inputSource: _fs2["default"].readFileSync(filename).toString()
}).then(function (_ref) {
  var generate = _ref.generate;

  return generate({
    outputRelativeLocation: "file.compiled.js"
  }).then(function (_ref2) {
    var output = _ref2.output,
        outputAssets = _ref2.outputAssets;

    global.System = {
      register: function register(dependencies, fn) {
        fn(function () {}, {}).execute();
      }
    };

    eval(output);
    var collector = new _istanbul2["default"].Collector();
    collector.add(global.__coverage__);
    // const finalCoverage = collector.getFinalCoverage()
    var reporter = new _istanbul2["default"].Reporter();

    reporter.add("text");
    reporter.add("html");
    reporter.write(collector, false, function () {});
  });
});
//# sourceMappingURL=createCompile.test.js.map