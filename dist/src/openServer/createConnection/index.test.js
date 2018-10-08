"use strict";

var _index = require("./index.js");

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
}; // createBody() => closed with no data


{
  const body = (0, _index.createBody)();
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
} // createBody(data) => closed with data

{
  const body = (0, _index.createBody)("hello world");
  {
    const actual = getClosed(body);
    const expected = true;

    _assert.default.equal(actual, expected);
  }
  {
    const actual = getText(body);
    const expected = "hello world";

    _assert.default.equal(actual, expected);
  }
} // createBody(dataSource) => closed when dataSource is closed

{
  const dataSource = (0, _index.createTwoWayStream)();
  const body = (0, _index.createBody)(dataSource);
  {
    const actual = getClosed(body);
    const expected = false;

    _assert.default.equal(actual, expected);
  }
  dataSource.close();
  {
    const actual = getClosed(body);
    const expected = true;

    _assert.default.equal(actual, expected);
  }
}
console.log("passed");
//# sourceMappingURL=index.test.js.map