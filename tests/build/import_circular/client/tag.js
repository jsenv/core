import { executionOrder } from "./execution_order.js";
/* eslint-disable import/no-cycle */
import * as D from "./data.js";
/* eslint-enable import/no-cycle */
import "./index.js";

executionOrder.push("tag");

export function Tag() {
  return `Tag ${D.data()}`;
}
