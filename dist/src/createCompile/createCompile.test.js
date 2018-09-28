"use strict";

var _createCompile = require("./createCompile.js");

var _instrumenterBabel = require("./instrumenter-babel.js");

var _istanbul = _interopRequireDefault(require("istanbul"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

var projectRoot = _path.default.resolve(__dirname, "../../../");

var filename = "".concat(projectRoot, "/src/createCompile/file.js");
compile({
  rootLocation: projectRoot,
  filename: filename,
  inputRelativeLocation: "src/createCompile/file.js",
  inputSource: _fs.default.readFileSync(filename).toString(),
  groupId: "nothing"
}).then(function (_ref) {
  var generate = _ref.generate;
  return generate({
    outputRelativeLocation: "file.compiled.js",
    getPluginsFromGroupId: function getPluginsFromGroupId() {
      return [];
    }
  }).then(function (_ref2) {
    var output = _ref2.output;
    global.System = {
      register: function register(dependencies, fn) {
        fn(function () {}, {}).execute();
      }
    };
    eval(output);
    var collector = new _istanbul.default.Collector();
    collector.add(global.__coverage__); // const finalCoverage = collector.getFinalCoverage()

    var reporter = new _istanbul.default.Reporter();
    reporter.add("text");
    reporter.add("html");
    reporter.write(collector, false, function () {});
  });
});
//# sourceMappingURL=createCompile.test.js.map