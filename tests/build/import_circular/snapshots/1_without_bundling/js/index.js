import { executionOrder } from "/js/execution_order.js?v=f54afd1a";
/* eslint-disable import/no-cycle */
import { Data, data } from "/js/data.js?v=4bf0fb76";
import { Tag } from "/js/tag.js?v=7fe866f5";
/* eslint-enable import/no-cycle */

executionOrder.push("index");
export { Data, data, Tag };