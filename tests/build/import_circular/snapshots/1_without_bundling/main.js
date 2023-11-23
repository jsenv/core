import { executionOrder } from "./js/execution_order.js";
import { Data } from "./js/data.js";
import { Tag } from "./js/tag.js";
import "./js/index.js";
executionOrder.push("main: ".concat(Data(), " ").concat(Tag()));
export { executionOrder };