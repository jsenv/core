import { findFreePort } from "./findFreePort.js"
import { test } from "@dmail/test"
import assert from "assert"

test(() => {
	return findFreePort().then((port) => {
		assert.equal(typeof port, "number")
	})
})
