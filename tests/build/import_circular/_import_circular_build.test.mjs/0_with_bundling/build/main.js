var executionOrder = [];

/* eslint-enable import-x/no-cycle */

executionOrder.push("index");

executionOrder.push("tag");
function Tag() {
  return "Tag ".concat(data());
}

executionOrder.push("data");
var data = function data() {
  return "data";
};
var Data = function Data() {
  return "Tag: ".concat(Tag());
};

// tslint:disable:ordered-imports

executionOrder.push("main: ".concat(Data(), " ").concat(Tag()));

export { executionOrder };
