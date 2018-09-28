"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCoverageFromTestReport = exports.testProject = void 0;

var _openChromiumClient = require("../openChromiumClient/openChromiumClient.js");

var _path = _interopRequireDefault(require("path"));

var _istanbulLibCoverage = require("istanbul-lib-coverage");

var _projectStructure = require("@dmail/project-structure");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var mergeCoverage = function mergeCoverage() {
  for (var _len = arguments.length, coverages = new Array(_len), _key = 0; _key < _len; _key++) {
    coverages[_key] = arguments[_key];
  }

  // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
  var mergedCoverageMap = coverages.reduce(function (previous, coverage) {
    return previous.merge(coverage);
  }, (0, _istanbulLibCoverage.createCoverageMap)({}));
  return mergedCoverageMap.toJSON();
};

var metaPredicate = function metaPredicate(_ref) {
  var cover = _ref.cover,
      test = _ref.test;
  return cover || test;
};

var testProject = function testProject(_ref2) {
  var server = _ref2.server,
      _ref2$createClient = _ref2.createClient,
      createClient = _ref2$createClient === void 0 ? function () {
    return (0, _openChromiumClient.openChromiumClient)({
      compileURL: server.compileURL
    });
  } : _ref2$createClient,
      _ref2$root = _ref2.root,
      root = _ref2$root === void 0 ? process.cwd() : _ref2$root,
      _ref2$beforeAll = _ref2.beforeAll,
      beforeAll = _ref2$beforeAll === void 0 ? function () {} : _ref2$beforeAll,
      _ref2$beforeEach = _ref2.beforeEach,
      beforeEach = _ref2$beforeEach === void 0 ? function () {} : _ref2$beforeEach,
      _ref2$afterEach = _ref2.afterEach,
      afterEach = _ref2$afterEach === void 0 ? function () {} : _ref2$afterEach,
      _ref2$afterAll = _ref2.afterAll,
      afterAll = _ref2$afterAll === void 0 ? function () {} : _ref2$afterAll;

  var rootLocation = _path.default.resolve(process.cwd(), root);

  var getRequiredFileReport = (0, _projectStructure.createRoot)({
    root: rootLocation
  }).then(function (_ref3) {
    var forEachFileMatching = _ref3.forEachFileMatching;
    return forEachFileMatching(metaPredicate, function (_ref4) {
      var relativeName = _ref4.relativeName,
          meta = _ref4.meta;
      return {
        relativeName: relativeName,
        meta: meta
      };
    });
  });
  return Promise.all([createClient(), getRequiredFileReport()]).then(function (_ref5) {
    var _ref6 = _slicedToArray(_ref5, 2),
        client = _ref6[0],
        fileReport = _ref6[1];

    var testFiles = fileReport.filter(function (file) {
      return file.meta.test;
    }).map(function (file) {
      return {
        path: "".concat(rootLocation, "/").concat(file.relativeName),
        type: "test"
      };
    });
    var sourceFiles = fileReport.filter(function (file) {
      return file.meta.cover;
    }).map(function (file) {
      return {
        path: "".concat(rootLocation, "/").concat(file.relativeName),
        type: "source"
      };
    });

    var files = _toConsumableArray(testFiles).concat(_toConsumableArray(sourceFiles));

    var getFileByPath = function getFileByPath(path) {
      return files.find(function (file) {
        return file.path === path;
      });
    };

    beforeAll({
      files: files
    });
    return Promise.all(testFiles.map(function (testFile) {
      beforeEach({
        file: testFile
      });
      return client.execute({
        file: testFile.path,
        collectCoverage: true,
        executeTest: true,
        autoClose: true
      }).then(function (_ref7) {
        var promise = _ref7.promise;
        return promise;
      }).then(function (_ref8) {
        var output = _ref8.output,
            coverage = _ref8.coverage;
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
        afterEach({
          file: testFile
        });
      });
    })).then(function () {
      afterAll({
        files: files
      });
      var untestedSourceFiles = sourceFiles.filter(function (sourceFile) {
        return !sourceFile.coverage;
      });

      var getEmptyCoverageFor = function getEmptyCoverageFor(file) {
        // we must compileFile to get the coverage object
        // without evaluating the file source because it would increment coverage
        // and also execute code that is not supposed to be run
        return server.compileFile(file).then(function (_ref9) {
          var outputAssets = _ref9.outputAssets;
          var coverageAsset = outputAssets.find(function (asset) {
            return asset.name === "coverage";
          });
          var coverage = JSON.parse(coverageAsset.content); // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229

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

exports.testProject = testProject;

var createCoverageFromTestReport = function createCoverageFromTestReport(files) {
  var coverage = {};
  files.forEach(function (file) {
    if (file.coverage) {
      coverage[file.coverage.path] = file.coverage;
    }
  });
  return coverage;
};

exports.createCoverageFromTestReport = createCoverageFromTestReport;
//# sourceMappingURL=coverFolder.js.map