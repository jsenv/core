import { executionOrder } from "./execution_order.js";
/* eslint-disable import-x/no-cycle */
import * as D from "./data.js";
/* eslint-enable import-x/no-cycle */
import "./index.js";
executionOrder.push("tag");
export function Tag() {
  return "Tag ".concat(D.data());
}