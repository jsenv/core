"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNodeSetupAndTeardowm = exports.getBrowserSetupAndTeardowm = void 0;

// keep in mind that setup and teardown will be stringified and evaluated client side
// you cannot use any variable from server
const teardownForOutputAndCoverage = namespace => {
  return Promise.resolve(namespace.output).then(output => {
    const globalObject = typeof window === "object" ? window : global;
    return {
      output,
      coverage: "__coverage__" in globalObject ? globalObject.__coverage__ : null
    };
  });
};

const teardownForOutput = namespace => {
  return Promise.resolve(namespace.output);
};

const getTeardown = ({
  collectCoverage,
  collectTest
}) => {
  if (collectTest) {
    return collectCoverage ? teardownForOutputAndCoverage : teardownForOutput;
  }

  return collectCoverage ? teardownForOutputAndCoverage : teardownForOutput;
};

const getBrowserSetupAndTeardowm = ({
  collectCoverage,
  collectTest
}) => {
  const setup = () => {};

  return {
    setup,
    teardown: getTeardown({
      collectCoverage,
      collectTest
    })
  };
};

exports.getBrowserSetupAndTeardowm = getBrowserSetupAndTeardowm;

const getNodeSetupAndTeardowm = ({
  collectCoverage,
  collectTest
}) => {
  const setup = () => {};

  return {
    setup,
    teardown: getTeardown({
      collectCoverage,
      collectTest
    })
  };
};

exports.getNodeSetupAndTeardowm = getNodeSetupAndTeardowm;
//# sourceMappingURL=getClientSetupAndTeardown.js.map