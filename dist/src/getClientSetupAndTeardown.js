"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
// keep in mind that setup and teardown will be stringified and evaluated client side
// you cannot use any variable from server

var teardownForOutputAndCoverage = function teardownForOutputAndCoverage(namespace) {
  return Promise.resolve(namespace.output).then(function (output) {
    var globalObject = typeof window === "object" ? window : global;

    return {
      output: output,
      coverage: "__coverage__" in globalObject ? globalObject.__coverage__ : null
    };
  });
};

var teardownForOutput = function teardownForOutput(namespace) {
  return Promise.resolve(namespace.output);
};

var getTeardown = function getTeardown(_ref) {
  var collectCoverage = _ref.collectCoverage,
      collectTest = _ref.collectTest;

  if (collectTest) {
    return collectCoverage ? teardownForOutputAndCoverage : teardownForOutput;
  }
  return collectCoverage ? teardownForOutputAndCoverage : teardownForOutput;
};

var getBrowserSetupAndTeardowm = exports.getBrowserSetupAndTeardowm = function getBrowserSetupAndTeardowm(_ref2) {
  var collectCoverage = _ref2.collectCoverage,
      collectTest = _ref2.collectTest;

  var setup = function setup() {};

  return {
    setup: setup,
    teardown: getTeardown({ collectCoverage: collectCoverage, collectTest: collectTest })
  };
};

var getNodeSetupAndTeardowm = exports.getNodeSetupAndTeardowm = function getNodeSetupAndTeardowm(_ref3) {
  var collectCoverage = _ref3.collectCoverage,
      collectTest = _ref3.collectTest;

  var setup = function setup() {};

  return {
    setup: setup,
    teardown: getTeardown({ collectCoverage: collectCoverage, collectTest: collectTest })
  };
};
//# sourceMappingURL=getClientSetupAndTeardown.js.map