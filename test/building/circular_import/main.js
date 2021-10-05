import { executionOrder } from "./execution_order.js"
import { Data } from "./data.js"
import { Tag } from "./tag.js"
import "./index.js"

executionOrder.push(`main: ${Data()} ${Tag()}`)

export { executionOrder }
