import { executionOrder } from "./execution_order.js";
/* eslint-disable import-x/no-cycle */
import { Tag } from "./tag.js";
/* eslint-enable import-x/no-cycle */
import "./index.js";
executionOrder.push("data");
export const data = () => "data";
export const Data = () => "Tag: ".concat(Tag());