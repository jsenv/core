import fs from "fs"
import { writeFileFromString } from "./writeFileFromString.js"
import { createAction } from "@dmail/action"

export const readFileAsString = ({ location, defaultContent, errorMapper }) => {
	const hasDefaultContent = defaultContent !== undefined
	const action = createAction()

	fs.readFile(location, (error, buffer) => {
		if (error) {
			if (error.code === "ENOENT" && hasDefaultContent) {
				return writeFileFromString(location, defaultContent).then(() => defaultContent)
			}
			if (errorMapper) {
				return action.fail(errorMapper(error))
			}
			throw error
		} else {
			action.pass(String(buffer))
		}
	})

	return action
}
