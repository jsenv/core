const executionOrder = [];

/* eslint-enable import/no-cycle */

executionOrder.push("index");

executionOrder.push("tag");
function Tag() {
  return "Tag ".concat(data());
}

executionOrder.push("data");
const data = () => "data";
const Data = () => "Tag: ".concat(Tag());

executionOrder.push("main: ".concat(Data(), " ").concat(Tag()));

export { executionOrder };
