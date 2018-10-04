"use strict";

var _compileProfiles = require("./compileProfiles/compileProfiles.js");

var _createGetProfileForPlatform = require("./createGetProfileForPlatform.js");

var _assert = _interopRequireDefault(require("assert"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

{
  const getProfileForPlatform = (0, _createGetProfileForPlatform.createGetProfileForPlatform)((0, _compileProfiles.compileProfiles)({
    compatMap: {
      a: {
        chrome: "41"
      }
    }
  }));
  {
    const actual = getProfileForPlatform({
      platformName: "chrome",
      platformVersion: "39"
    }).pluginNames;
    const expected = ["a"];

    _assert.default.deepEqual(actual, expected);
  }
  {
    const actual = getProfileForPlatform({
      platformName: "chrome",
      platformVersion: "41"
    }).pluginNames;
    const expected = [];

    _assert.default.deepEqual(actual, expected);
  }
  {
    const actual = getProfileForPlatform({
      platformName: "chrome",
      platformVersion: "42"
    }).pluginNames;
    const expected = [];

    _assert.default.deepEqual(actual, expected);
  }
}
{
  const getProfileForPlatform = (0, _createGetProfileForPlatform.createGetProfileForPlatform)((0, _compileProfiles.compileProfiles)({
    compatMap: {
      a: {
        chrome: "41"
      },
      b: {
        chrome: "42"
      }
    },
    size: 1
  }));
  const actual = getProfileForPlatform({
    platformName: "chrome",
    platformVersion: "41" // even if chrome 41, we serve a because in same group than chrome 42

  }).pluginNames;
  const expected = ["a", "b"];

  _assert.default.deepEqual(actual, expected);
}
{
  const getProfileForPlatform = (0, _createGetProfileForPlatform.createGetProfileForPlatform)((0, _compileProfiles.compileProfiles)({
    compatMap: {
      a: {
        chrome: "60"
      }
    },
    size: 1
  }));
  const actual = getProfileForPlatform({
    platformName: "firefox",
    platformVersion: "70"
  }).pluginNames;
  const expected = ["a"];

  _assert.default.deepEqual(actual, expected);
}
{
  const getProfileForPlatform = (0, _createGetProfileForPlatform.createGetProfileForPlatform)((0, _compileProfiles.compileProfiles)({
    compatMap: {
      a: {}
    },
    size: 1
  }));
  const actual = getProfileForPlatform({
    platformName: "chrome",
    platformVersion: "50"
  }).pluginNames;
  const expected = ["a"];

  _assert.default.deepEqual(actual, expected);
}
{
  const getProfileForPlatform = (0, _createGetProfileForPlatform.createGetProfileForPlatform)((0, _compileProfiles.compileProfiles)({
    compatMap: {
      a: {
        chrome: "42"
      }
    },
    size: 1
  }));
  const actual = getProfileForPlatform({
    platformName: "chrome",
    platformVersion: "41" // even if chrome 41, we serve a because in same group than chrome 42

  }).pluginNames;
  const expected = ["a"];

  _assert.default.deepEqual(actual, expected);
}
{
  const getProfileForPlatform = (0, _createGetProfileForPlatform.createGetProfileForPlatform)((0, _compileProfiles.compileProfiles)({
    compatMap: {
      a: {
        chrome: "42"
      },
      b: {}
    },
    size: 4
  }));
  const actual = getProfileForPlatform({
    platformName: "chrome",
    platformVersion: "45"
  }).pluginNames;
  const expected = ["b"];

  _assert.default.deepEqual(actual, expected);
}
{
  const getProfileForPlatform = (0, _createGetProfileForPlatform.createGetProfileForPlatform)((0, _compileProfiles.compileProfiles)({
    platformNames: ["node"]
  }));
  const actual = getProfileForPlatform({
    platformName: "node",
    platformVersion: "8.0"
  }).pluginNames;
  const expected = ["proposal-async-generator-functions", "proposal-json-strings", "proposal-object-rest-spread", "proposal-optional-catch-binding", "proposal-unicode-property-regex", "transform-async-to-generator", "transform-dotall-regex", "transform-exponentiation-operator"];

  _assert.default.deepEqual(actual, expected);
}
console.log("passed");
//# sourceMappingURL=createGetProfileForPlatform.test.js.map