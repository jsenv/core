import { executionOrder } from "/js/execution_order.js?v=f54afd1a";
/* eslint-disable import/no-cycle */
import * as D from "/js/data.js?v=4bf0fb76";
/* eslint-enable import/no-cycle */
import "/js/index.js?v=4e515a3e";
executionOrder.push("tag");
export function Tag() {
  return "Tag ".concat(D.data());
}