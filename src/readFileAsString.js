import fs from "fs"
import { writeFileFromString } from "./writeFileFromString.js"

export const readFileAsString = (path, defaultContent) => {
	const hasDefaultContent = defaultContent !== undefined

	return new Promise((resolve, reject) => {
		fs.readFile(path, (error, buffer) => {
			if (error) {
				if (error.code === "ENOENT" && hasDefaultContent) {
					return writeFileFromString(path, defaultContent).then(() => defaultContent)
				}
				return reject(error)
			}
			return resolve(String(buffer))
		})
	})
}
