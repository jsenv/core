"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCoverageFromTestReport = exports.testProject = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _openChromiumClient = require("../openChromiumClient/openChromiumClient.js");

var _globGitignore = require("glob-gitignore");

var _ignore = require("ignore");

var _ignore2 = _interopRequireDefault(_ignore);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _istanbulLibCoverage = require("istanbul-lib-coverage");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var mergeCoverage = function mergeCoverage() {
  for (var _len = arguments.length, coverages = Array(_len), _key = 0; _key < _len; _key++) {
    coverages[_key] = arguments[_key];
  }

  // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
  var mergedCoverageMap = coverages.reduce(function (previous, coverage) {
    return previous.merge(coverage);
  }, (0, _istanbulLibCoverage.createCoverageMap)({}));

  return mergedCoverageMap.toJSON();
};

var testProject = exports.testProject = function testProject(_ref) {
  var server = _ref.server,
      _ref$createClient = _ref.createClient,
      createClient = _ref$createClient === undefined ? function () {
    return (0, _openChromiumClient.openChromiumClient)({ compileURL: server.compileURL });
  } : _ref$createClient,
      _ref$root = _ref.root,
      root = _ref$root === undefined ? process.cwd() : _ref$root,
      _ref$beforeAll = _ref.beforeAll,
      beforeAll = _ref$beforeAll === undefined ? function () {} : _ref$beforeAll,
      _ref$beforeEach = _ref.beforeEach,
      beforeEach = _ref$beforeEach === undefined ? function () {} : _ref$beforeEach,
      _ref$afterEach = _ref.afterEach,
      afterEach = _ref$afterEach === undefined ? function () {} : _ref$afterEach,
      _ref$afterAll = _ref.afterAll,
      afterAll = _ref$afterAll === undefined ? function () {} : _ref$afterAll,
      _ref$sourceInclude = _ref.sourceInclude,
      sourceInclude = _ref$sourceInclude === undefined ? ["index.js", "src/**/*.js"] : _ref$sourceInclude,
      _ref$testInclude = _ref.testInclude,
      testInclude = _ref$testInclude === undefined ? ["index.test.js", "src/**/*.test.js"] : _ref$testInclude,
      _ref$sourceExclude = _ref.sourceExclude,
      sourceExclude = _ref$sourceExclude === undefined ? [].concat(_toConsumableArray(testInclude)) : _ref$sourceExclude,
      _ref$testExclude = _ref.testExclude,
      testExclude = _ref$testExclude === undefined ? [] : _ref$testExclude,
      _ref$getTestIgnoreStr = _ref.getTestIgnoreString,
      getTestIgnoreString = _ref$getTestIgnoreStr === undefined ? function () {
    var filename = _path2["default"].resolve(process.cwd(), root, ".testignore");

    return new Promise(function (resolve, reject) {
      _fs2["default"].readFile(filename, function (error, buffer) {
        if (error) {
          if (error && error.code === "ENOENT") {
            resolve("");
          }
          reject(error);
        } else {
          resolve(buffer.toString());
        }
      });
    });
  } : _ref$getTestIgnoreStr;

  var absoluteLocation = _path2["default"].resolve(process.cwd(), root);

  // https://github.com/kaelzhang/node-ignore
  // https://github.com/kaelzhang/node-glob-gitignore
  // https://karma-runner.github.io/latest/config/plugins.html
  // https://karma-runner.github.io/latest/dev/plugins.html
  // https://www.npmjs.com/package/glob#options
  var getSourceFiles = function getSourceFiles() {
    return (0, _globGitignore.glob)(sourceInclude, {
      nodir: true,
      cwd: absoluteLocation,
      ignore: sourceExclude
    });
  };

  var getTestFiles = function getTestFiles() {
    return getTestIgnoreString().then(function (ignoreRules) {
      return (0, _ignore2["default"])().add(testExclude).add(ignoreRules);
    }).then(function (ignore) {
      return (0, _globGitignore.glob)(testInclude, {
        nodir: true,
        cwd: absoluteLocation,
        ignore: ignore._rules.map(function (_ref2) {
          var origin = _ref2.origin;
          return origin;
        })
      });
    });
  };

  return Promise.all([createClient(), getTestFiles(), getSourceFiles()]).then(function (_ref3) {
    var _ref4 = _slicedToArray(_ref3, 3),
        client = _ref4[0],
        testFiles = _ref4[1],
        sourceFiles = _ref4[2];

    testFiles = testFiles.map(function (testFile) {
      return {
        path: testFile,
        type: "test"
      };
    });
    sourceFiles = sourceFiles.map(function (sourceFile) {
      return {
        path: sourceFile,
        type: "source"
      };
    });

    var files = [].concat(_toConsumableArray(testFiles), _toConsumableArray(sourceFiles));

    var getFileByPath = function getFileByPath(path) {
      return files.find(function (file) {
        return file.path === path;
      });
    };

    beforeAll({ files: files });
    return Promise.all(testFiles.map(function (testFile) {
      beforeEach({ file: testFile });

      return client.execute({
        file: testFile.path,
        collectCoverage: true,
        executeTest: true,
        autoClose: true
      }).then(function (_ref5) {
        var promise = _ref5.promise;
        return promise;
      }).then(function (_ref6) {
        var output = _ref6.output,
            coverage = _ref6.coverage;

        // test = null means file.test.js do not set a global.__test
        // which happens if file.test.js does not use @dmail/test or is empty for instance
        // coverage = null means file.test.js do not set a global.__coverage__
        // which happens if file.test.js was not instrumented.
        // this is not supposed to happen so we should throw ?
        testFile.output = output;
        Object.keys(coverage).forEach(function (path) {
          var sourceFile = getFileByPath(path);
          sourceFile.coverage = sourceFile.coverage ? mergeCoverage(sourceFile.coverage, coverage[path]) : coverage[path];
        });

        afterEach({ file: testFile });
      });
    })).then(function () {
      afterAll({ files: files });

      var untestedSourceFiles = sourceFiles.filter(function (sourceFile) {
        return !sourceFile.coverage;
      });

      var getEmptyCoverageFor = function getEmptyCoverageFor(file) {
        // we must compileFile to get the coverage object
        // without evaluating the file source because it would increment coverage
        // and also execute code that is not supposed to be run
        return server.compileFile(file).then(function (_ref7) {
          var outputAssets = _ref7.outputAssets;

          var coverageAsset = outputAssets.find(function (asset) {
            return asset.name === "coverage";
          });
          var coverage = JSON.parse(coverageAsset.content);
          // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
          Object.keys(coverage.s).forEach(function (key) {
            coverage.s[key] = 0;
          });
          return coverage;
        });
      };

      return Promise.all(untestedSourceFiles.map(function (sourceFile) {
        return getEmptyCoverageFor(sourceFile).then(function (missingCoverage) {
          sourceFile.coverage = missingCoverage;
        });
      }));
    }).then(function () {
      return files;
    });
  });
};

var createCoverageFromTestReport = exports.createCoverageFromTestReport = function createCoverageFromTestReport(files) {
  var coverage = {};

  files.forEach(function (file) {
    if (file.coverage) {
      coverage[file.coverage.path] = file.coverage;
    }
  });

  return coverage;
};
//# sourceMappingURL=coverFolder.js.map