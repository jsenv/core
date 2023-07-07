import { executionOrder } from "/js/execution_order.js?v=f54afd1a";
/* eslint-disable import/no-cycle */
import { Tag } from "/js/tag.js?v=0a4276e2";
/* eslint-enable import/no-cycle */
import "/js/index.js?v=2252bede";
executionOrder.push("data");
export const data = () => "data";
export const Data = () => "Tag: ".concat(Tag());