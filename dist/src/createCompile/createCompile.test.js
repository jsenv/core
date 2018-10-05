"use strict";

var _createCompile = require("./createCompile.js");

var _instrumenterBabel = require("./instrumenter-babel.js");

var _istanbul = _interopRequireDefault(require("istanbul"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const compile = (0, _createCompile.createCompile)({
  instrumenter: _instrumenterBabel.instrumenter,
  createOptions: () => {
    return {
      transpile: true,
      instrument: true,
      remapMethod: "comment"
    };
  }
});

const projectRoot = _path.default.resolve(__dirname, "../../../");

const filename = `${projectRoot}/src/createCompile/file.js`;
compile({
  rootLocation: projectRoot,
  filename,
  inputRelativeLocation: "src/createCompile/file.js",
  inputSource: _fs.default.readFileSync(filename).toString(),
  groupId: "nothing"
}).then(({
  generate
}) => {
  return generate({
    outputRelativeLocation: "file.compiled.js",
    getBabelPlugins: () => []
  }).then(({
    output
  }) => {
    global.System = {
      register: (dependencies, fn) => {
        fn(() => {}, {}).execute();
      }
    };
    eval(output);
    const collector = new _istanbul.default.Collector();
    collector.add(global.__coverage__); // const finalCoverage = collector.getFinalCoverage()

    const reporter = new _istanbul.default.Reporter();
    reporter.add("text");
    reporter.add("html");
    reporter.write(collector, false, () => {});
  });
});
//# sourceMappingURL=createCompile.test.js.map