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

const mergeCoverage = (...coverages) => {
  // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
  const mergedCoverageMap = coverages.reduce((previous, coverage) => {
    return previous.merge(coverage);
  }, (0, _istanbulLibCoverage.createCoverageMap)({}));
  return mergedCoverageMap.toJSON();
};

const metaPredicate = ({
  cover,
  test
}) => cover || test;

const testProject = ({
  server,
  createClient = () => (0, _openChromiumClient.openChromiumClient)({
    compileURL: server.compileURL
  }),
  root = process.cwd(),
  beforeAll = () => {},
  beforeEach = () => {},
  afterEach = () => {},
  afterAll = () => {}
}) => {
  const rootLocation = _path.default.resolve(process.cwd(), root);

  const getRequiredFileReport = (0, _projectStructure.createRoot)({
    root: rootLocation
  }).then(({
    forEachFileMatching
  }) => {
    return forEachFileMatching(metaPredicate, ({
      relativeName,
      meta
    }) => {
      return {
        relativeName,
        meta
      };
    });
  });
  return Promise.all([createClient(), getRequiredFileReport()]).then(([client, fileReport]) => {
    const testFiles = fileReport.filter(file => file.meta.test).map(file => {
      return {
        path: `${rootLocation}/${file.relativeName}`,
        type: "test"
      };
    });
    const sourceFiles = fileReport.filter(file => file.meta.cover).map(file => {
      return {
        path: `${rootLocation}/${file.relativeName}`,
        type: "source"
      };
    });
    const files = [...testFiles, ...sourceFiles];

    const getFileByPath = path => files.find(file => file.path === path);

    beforeAll({
      files
    });
    return Promise.all(testFiles.map(testFile => {
      beforeEach({
        file: testFile
      });
      return client.execute({
        file: testFile.path,
        collectCoverage: true,
        executeTest: true,
        autoClose: true
      }).then(({
        promise
      }) => promise).then(({
        output,
        coverage
      }) => {
        // test = null means file.test.js do not set a global.__test
        // which happens if file.test.js does not use @dmail/test or is empty for instance
        // coverage = null means file.test.js do not set a global.__coverage__
        // which happens if file.test.js was not instrumented.
        // this is not supposed to happen so we should throw ?
        testFile.output = output;
        Object.keys(coverage).forEach(path => {
          const sourceFile = getFileByPath(path);
          sourceFile.coverage = sourceFile.coverage ? mergeCoverage(sourceFile.coverage, coverage[path]) : coverage[path];
        });
        afterEach({
          file: testFile
        });
      });
    })).then(() => {
      afterAll({
        files
      });
      const untestedSourceFiles = sourceFiles.filter(sourceFile => {
        return !sourceFile.coverage;
      });

      const getEmptyCoverageFor = file => {
        // we must compileFile to get the coverage object
        // without evaluating the file source because it would increment coverage
        // and also execute code that is not supposed to be run
        return server.compileFile(file).then(({
          outputAssets
        }) => {
          const coverageAsset = outputAssets.find(asset => asset.name === "coverage");
          const coverage = JSON.parse(coverageAsset.content); // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229

          Object.keys(coverage.s).forEach(function (key) {
            coverage.s[key] = 0;
          });
          return coverage;
        });
      };

      return Promise.all(untestedSourceFiles.map(sourceFile => {
        return getEmptyCoverageFor(sourceFile).then(missingCoverage => {
          sourceFile.coverage = missingCoverage;
        });
      }));
    }).then(() => {
      return files;
    });
  });
};

exports.testProject = testProject;

const createCoverageFromTestReport = files => {
  const coverage = {};
  files.forEach(file => {
    if (file.coverage) {
      coverage[file.coverage.path] = file.coverage;
    }
  });
  return coverage;
};

exports.createCoverageFromTestReport = createCoverageFromTestReport;
//# sourceMappingURL=coverFolder.js.map