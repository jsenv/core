import { executionOrder } from "./execution_order.js"
import * as D from "./data.js"
import "./index.js"

executionOrder.push("tag")

export function Tag() {
  return `Tag ${D.data()}`
}
