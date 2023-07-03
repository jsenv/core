import { executionOrder } from "/js/execution_order.js?v=f54afd1a";
/* eslint-disable import/no-cycle */
import * as D from "/js/data.js?v=57864a6e";
/* eslint-enable import/no-cycle */
import "/js/index.js?v=2252bede";
executionOrder.push("tag");
export function Tag() {
  return "Tag ".concat(D.data());
}