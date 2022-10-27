import { executionOrder } from "./execution_order.js"
/* eslint-disable import/no-cycle */
import { Tag } from "./tag.js"
/* eslint-enable import/no-cycle */
import "./index.js"

executionOrder.push("data")

export const data = () => "data"
export const Data = () => `Tag: ${Tag()}`
