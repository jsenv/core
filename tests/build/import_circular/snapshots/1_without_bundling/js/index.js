import { executionOrder } from "/js/execution_order.js?v=f54afd1a";
/* eslint-disable import/no-cycle */
import { Data, data } from "/js/data.js?v=57864a6e";
import { Tag } from "/js/tag.js?v=0a4276e2";
/* eslint-enable import/no-cycle */

executionOrder.push("index");
export { Data, data, Tag };