import fetch from "node-fetch"
import https from "https"
import { readFileAsString } from "../readFileAsString"
import { fromPromise } from "@dmail/action"

https.globalAgent.options.rejectUnauthorized = false

// not sure the fromPromise is important
export const fetchModuleFromServer = (key) =>
	fromPromise(fetch(key).then((response) => response.text()))

export const fetchModuleFromFileSystem = (key) => readFileAsString(key)
