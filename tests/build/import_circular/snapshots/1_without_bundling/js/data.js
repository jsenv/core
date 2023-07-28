import { executionOrder } from "/js/execution_order.js?v=f54afd1a";
/* eslint-disable import/no-cycle */
import { Tag } from "/js/tag.js?v=7fe866f5";
/* eslint-enable import/no-cycle */
import "/js/index.js?v=4e515a3e";
executionOrder.push("data");
export const data = () => "data";
export const Data = () => "Tag: ".concat(Tag());