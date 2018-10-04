"use strict";

var _createGetScoreForGroupCompatMap = require("./createGetScoreForGroupCompatMap.js");

var _assert = _interopRequireDefault(require("assert"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

{
  const chrome50Score = 1;
  const chrome49Score = 2;
  const chromeBelow49Score = 4;
  const otherScore = 8;
  const getScore = (0, _createGetScoreForGroupCompatMap.createGetScoreForGroupCompatMap)({
    chrome: {
      "50": chrome50Score,
      "49": chrome49Score,
      "0": chromeBelow49Score
    },
    other: otherScore
  });
  {
    const actual = getScore({
      chrome: "48"
    });
    const expected = chromeBelow49Score;

    _assert.default.equal(actual, expected);
  }
  {
    const actual = getScore({
      chrome: "49"
    });
    const expected = chrome49Score;

    _assert.default.equal(actual, expected);
  }
  {
    const actual = getScore({
      chrome: "50"
    });
    const expected = chrome50Score;

    _assert.default.equal(actual, expected);
  }
  {
    const actual = getScore({
      chrome: "51"
    });
    const expected = chrome50Score;

    _assert.default.equal(actual, expected);
  }
  {
    const actual = getScore({
      chrome: "51",
      foo: ["0"]
    });
    const expected = chrome50Score + otherScore;

    _assert.default.equal(actual, expected);
  }
}
console.log("passed");
//# sourceMappingURL=createGetScoreForGroupCompatMap.test.js.map