import fetch from "node-fetch/lib/index.es.js"
import https from "https"
import fs from "fs"

https.globalAgent.options.rejectUnauthorized = false

export const fetchModuleFromServer = (key) => fetch(key).then((response) => response.text())

export const fetchModuleFromFileSystem = (key) =>
	new Promise((resolve, reject) => {
		fs.readFile(key, (error, buffer) => {
			if (error) {
				reject(error)
			} else {
				resolve(String(buffer))
			}
		})
	})
