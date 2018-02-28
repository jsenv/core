import fs from "fs"
import path from "path"
import { URL } from "url"
import { createAction, passed } from "@dmail/action"

const mimetype = (fileURL) => {
	const defaultMimetype = "application/octet-stream"

	const mimetypes = {
		// text
		txt: "text/plain",
		html: "text/html",
		css: "text/css",
		appcache: "text/cache-manifest",
		// application
		js: "application/javascript",
		json: "application/json",
		xml: "application/xml",
		gz: "application/x-gzip",
		zip: "application/zip",
		pdf: "application/pdf",
		// image
		png: "image/png",
		gif: "image/gif",
		jpg: "image/jpeg",
		// audio
		mp3: "audio/mpeg",
	}

	const suffix = path.extname(String(fileURL))
	if (suffix in mimetypes) {
		return mimetypes[suffix]
	}

	return defaultMimetype
}

const isErrorWithCode = (error, code) => {
	return typeof error === "object" && error.code === code
}

export const convertFileSystemErrorToResponseProperties = (error) => {
	// https://iojs.org/api/errors.html#errors_eacces_permission_denied
	if (isErrorWithCode(error, "EACCES")) {
		return {
			status: 403,
			reason: "no permission to read file",
		}
	}

	if (isErrorWithCode(error, "EPERM")) {
		return {
			status: 403,
			reason: "no permission to read file",
		}
	}

	if (isErrorWithCode(error, "ENOENT")) {
		return {
			status: 404,
			reason: "file not found",
		}
	}

	// file access may be temporarily blocked
	// (by an antivirus scanning it because recently modified for instance)
	if (isErrorWithCode(error, "EBUSY")) {
		return {
			status: 503,
			reason: "file is busy",
			headers: {
				"retry-after": 0.01, // retry in 10ms
			},
		}
	}

	// emfile means there is too many files currently opened
	if (isErrorWithCode(error, "EMFILE")) {
		return {
			status: 503,
			reason: "too many file opened",
			headers: {
				"retry-after": 0.1, // retry in 100ms
			},
		}
	}

	return {
		status: 500,
		reason: "unknown file system error",
	}
}

const stat = (location) => {
	const action = createAction()

	fs.stat(location, (error, stat) => {
		if (error) {
			action.fail(convertFileSystemErrorToResponseProperties(error))
		} else {
			action.pass(stat)
		}
	})

	return action
}

const listDirectoryContent = (location) => {
	const action = createAction()

	fs.readdir(location, (error, ressourceNames) => {
		if (error) {
			throw error
		} else {
			action.pass(ressourceNames)
		}
	})

	return action
}

export const createFileService = ({
	location,
	include = () => true,
	canReadDirectory = false,
} = {}) => {
	const locationURL = new URL(`file:///${location}`)

	return ({ method, url, headers: requestHeaders }) => {
		if (!include(url)) {
			return false
		}

		let status
		let reason
		const headers = {}
		let body

		headers["cache-control"] = "no-store"

		let action

		if (method === "GET" || method === "HEAD") {
			action = passed().then(() => {
				const fileURL = new URL(url.pathname.slice(1), locationURL)
				const fileLocation = fileURL.pathname

				let cachedModificationDate
				if (requestHeaders.has("if-modified-since")) {
					try {
						cachedModificationDate = new Date(requestHeaders.get("if-modified-since"))
					} catch (e) {
						status = 400
						reason = "if-modified-since header is not a valid date"
						return {
							status,
							reason,
							headers,
							body,
						}
					}
				}

				return stat(fileLocation).then(
					(stat) => {
						const actualModificationDate = stat.mtime

						headers["last-modified"] = actualModificationDate.toUTCString()

						if (stat.isDirectory()) {
							if (canReadDirectory === false) {
								status = 403
								reason = "not allowed to read directory"
								return
							}

							return listDirectoryContent(fileLocation)
								.then(JSON.stringify)
								.then((directoryListAsJSON) => {
									status = 200
									headers["content-type"] = "application/json"
									headers["content-length"] = directoryListAsJSON.length
									body = directoryListAsJSON
								})
						}

						if (
							cachedModificationDate &&
							Number(cachedModificationDate) < Number(actualModificationDate)
						) {
							status = 304
							return
						}

						status = 200
						headers["content-type"] = mimetype(url)
						headers["content-length"] = stat.size
						body = fs.createReadStream(fileLocation)
					},
					({
						status: responseStatus,
						reason: responseReason,
						headers: responseHeaders = {},
						body: responseBody,
					}) => {
						status = responseStatus
						reason = responseReason
						Object.assign(headers, responseHeaders)
						body = responseBody
						return passed()
					},
				)
			})
		} else {
			status = 501
			action = passed()
		}

		return action.then(() => {
			return {
				status,
				reason,
				headers,
				body,
			}
		})
	}
}
