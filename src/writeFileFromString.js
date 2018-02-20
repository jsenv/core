import fs from "fs"

const getFileLStat = (path) => {
	return new Promise((resolve, reject) => {
		fs.lstat(path, (error, lstat) => {
			if (error) {
				return reject(error)
			}
			return resolve(lstat)
		})
	})
}

const createDirectory = (path) => {
	return new Promise((resolve, reject) => {
		fs.mkdir(path, (error) => {
			if (error) {
				return reject(error)
			}
			return resolve()
		})
	})
}

const createFolder = (path) => {
	return createDirectory(path).catch((error) => {
		// au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
		if (error.code === "EEXIST") {
			// vérifie que c'est bien un dossier
			return getFileLStat(path).then((stat) => {
				if (stat) {
					if (stat.isDirectory()) {
						return
					}
					// console.log('there is a file at', path);
					throw error
				}
			})
		}

		return Promise.reject(error)
	})
}

const createFolderUntil = (path) => {
	path = path.replace(/\\/g, "/")
	const folders = path.split("/")

	folders.pop()

	return folders.reduce((previous, directory, index) => {
		return previous.then(() => createFolder(folders.slice(0, index + 1).join("/")))
	}, Promise.resolve())
}

const writeFile = (path, content) => {
	return new Promise((resolve, reject) => {
		fs.writeFile(path, content, (error) => {
			if (error) {
				return reject(error)
			}
			resolve()
		})
	})
}

export const writeFileFromString = (path, string) => {
	return createFolderUntil(path).then(() => writeFile(path, string))
}
