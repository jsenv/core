import fs from "fs"
import { createAction, sequence } from "@dmail/action"

const getFileLStat = (path) => {
	const action = createAction()

	fs.lstat(path, (error, lstat) => {
		if (error) {
			throw error
		} else {
			action.pass(lstat)
		}
	})

	return action
}

const createFolder = (path) => {
	const action = createAction()

	fs.mkdir(path, (error) => {
		if (error) {
			// au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
			if (error.code === "EEXIST") {
				return getFileLStat(path).then((stat) => {
					if (stat.isDirectory()) {
						return action.pass()
					}
					throw error
				})
			}
			throw error
		} else {
			action.pass()
		}
	})

	return action
}

const createFolderUntil = (path) => {
	path = path.replace(/\\/g, "/")
	// remove first / in case path starts with / (linux)
	// because it would create a "" entry in folders array below
	// tryig to create a folder at ""
	const pathStartsWithSlash = path[0] === "/"
	if (pathStartsWithSlash) {
		path = path.slice(1)
	}
	const folders = path.split("/")

	folders.pop()

	return sequence(folders, (folder, index) => {
		const folderLocation = folders.slice(0, index + 1).join("/")
		return createFolder(`${pathStartsWithSlash ? "/" : ""}${folderLocation}`)
	})
}

const writeFile = (path, content) => {
	const action = createAction()

	fs.writeFile(path, content, (error) => {
		if (error) {
			throw error
		} else {
			action.pass()
		}
	})

	return action
}

export const writeFileFromString = (path, string) => {
	return createFolderUntil(path).then(() => writeFile(path, string))
}
