import { listenNodeBeforeExit } from "./listenNodeBeforeExit.js"
import { test } from "@dmail/test"

test(() => {
	listenNodeBeforeExit(() => {})
})
