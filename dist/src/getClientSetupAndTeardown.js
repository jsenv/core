"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNodeSetupAndTeardowm = exports.getBrowserSetupAndTeardowm = void 0;

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// keep in mind that setup and teardown will be stringified and evaluated client side
// you cannot use any variable from server
var teardownForOutputAndCoverage = function teardownForOutputAndCoverage(namespace) {
  return Promise.resolve(namespace.output).then(function (output) {
    var globalObject = (typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" ? window : global;
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

var getBrowserSetupAndTeardowm = function getBrowserSetupAndTeardowm(_ref2) {
  var collectCoverage = _ref2.collectCoverage,
      collectTest = _ref2.collectTest;

  var setup = function setup() {};

  return {
    setup: setup,
    teardown: getTeardown({
      collectCoverage: collectCoverage,
      collectTest: collectTest
    })
  };
};

exports.getBrowserSetupAndTeardowm = getBrowserSetupAndTeardowm;

var getNodeSetupAndTeardowm = function getNodeSetupAndTeardowm(_ref3) {
  var collectCoverage = _ref3.collectCoverage,
      collectTest = _ref3.collectTest;

  var setup = function setup() {};

  return {
    setup: setup,
    teardown: getTeardown({
      collectCoverage: collectCoverage,
      collectTest: collectTest
    })
  };
};

exports.getNodeSetupAndTeardowm = getNodeSetupAndTeardowm;
//# sourceMappingURL=getClientSetupAndTeardown.js.map