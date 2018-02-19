import fs from "fs"
import { URL } from "url"
import path from "path"

const createExecutorCallback = (resolve, reject) => {
	return (error, result) => {
		if (error) {
			reject(error)
		} else {
			resolve(result)
		}
	}
}

const callback = (fn, ...args) => {
	return new Promise(function(resolve, reject) {
		args.push(createExecutorCallback(resolve, reject))
		fn(...args)
	})
}

const fsAsync = (methodName, ...args) => {
	return callback(...[fs[methodName], ...args])
}

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

	const suffix = path.extname(fileURL)
	if (suffix in mimetypes) {
		return mimetypes[suffix]
	}

	return defaultMimetype
}

const isErrorWithCode = (error, code) => {
	return typeof error === "object" && error.code === code
}

export const createFileService = ({
	include = () => true,
	root = "",
	index = "",
	canReadDirectory = false,
} = {}) => {
	const rootURL = new URL(`file:///${root}`)

	return ({ method, url, headers: requestHeaders }) => {
		if (!include(url)) {
			return false
		}

		if (method === "GET" || method === "HEAD") {
			const fileURL = new URL(url.pathname || index, rootURL)
			const filename = fileURL.pathname

			let status
			let reason
			const headers = {}
			let body

			headers["cache-control"] = "no-store"

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

			return fsAsync("stat", filename)
				.then((stat) => {
					const actualModificationDate = stat.mtime
					headers["last-modified"] = actualModificationDate.toUTCString()

					if (stat.isDirectory()) {
						if (canReadDirectory === false) {
							status = 403
							reason = "not allowed to read directory"
							return
						}

						return fsAsync("readdir", filename)
							.then(JSON.stringify)
							.then((directoryListAsJSON) => {
								status = 200
								headers["content-type"] = "application/json"
								headers["content-length"] = directoryListAsJSON.length
								body = directoryListAsJSON
							})
					}

					if (headers.has("if-modified-since")) {
						if (Number(cachedModificationDate) < Number(actualModificationDate)) {
							status = 304
							return
						}
					}

					status = 200
					headers["content-type"] = mimetype(fileURL)
					headers["content-length"] = stat.size
					body = fs.createReadStream(filename)
				})
				.catch((error) => {
					// https://iojs.org/api/errors.html#errors_eacces_permission_denied
					if (isErrorWithCode(error, "EACCES")) {
						status = 403
						reason = "no permission to read file"
						return
					}

					if (isErrorWithCode(error, "EPERM")) {
						status = 403
						reason = "no permission to read file"
						return
					}

					if (isErrorWithCode(error, "ENOENT")) {
						status = 404
						reason = "file not found"
						return
					}

					// file access may be temporarily blocked
					// (by an antivirus scanning it because recently modified for instance)
					if (isErrorWithCode(error, "EBUSY")) {
						status = 503
						reason = "file is busy"
						headers["retry-after"] = 0.01 // retry in 10ms
						return
					}

					// emfile means there is too many files currently opened
					if (isErrorWithCode(error, "EMFILE")) {
						status = 503
						reason = "too may file opened"
						headers["retry-after"] = 0.1 // retry in 100ms
						return
					}

					return Promise.reject(error)
				})
				.then(() => ({
					status,
					reason,
					headers,
					body,
				}))
		}

		return {
			status: 501,
		}
	}
}
