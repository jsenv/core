import { regexpEscape } from "./stringHelper.js"
import assert from "assert"

assert.equal(regexpEscape("/"), "\\/")

console.log("passed")
