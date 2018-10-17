import { regexpEscape } from "./regexpEscape.js"
import assert from "assert"

assert.equal(regexpEscape("/"), "\\/")

console.log("passed")
