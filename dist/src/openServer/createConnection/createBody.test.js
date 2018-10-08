"use strict";

var _createBody = require("./createBody.js");

var _assert = _interopRequireDefault(require("assert"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const getClosed = body => {
  let closed = false;
  body.closed.listen(() => {
    closed = true;
  });
  return closed;
};

const getText = body => {
  let text = "";
  body.writed.listen(data => {
    text += data;
  });
  return text;
};

{
  const body = (0, _createBody.createBody)();
  {
    const actual = getClosed(body);
    const expected = true;

    _assert.default.equal(actual, expected);
  }
  {
    const actual = getText(body);
    const expected = "";

    _assert.default.equal(actual, expected);
  }
}
//# sourceMappingURL=createBody.test.js.map