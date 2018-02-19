/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/

const normalizeName = (headerName) => {
	headerName = String(headerName)
	if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
		throw new TypeError("Invalid character in header field name")
	}

	return headerName.toLowerCase()
}

const normalizeValue = (headerValue) => {
	return String(headerValue)
}

// https://gist.github.com/mmazer/5404301
const parseHeaders = (headerString) => {
	var headers = {}
	var pairs
	var pair
	var index
	var i
	var j
	var key
	var value

	if (headerString) {
		pairs = headerString.split("\r\n")
		i = 0
		j = pairs.length
		for (; i < j; i++) {
			pair = pairs[i]
			index = pair.indexOf(": ")
			if (index > 0) {
				key = pair.slice(0, index)
				value = pair.slice(index + 2)
				headers[key] = value
			}
		}
	}

	return headers
}

export const createHeaders = (headers) => {
	const guard = "none"
	const map = new Map()

	const checkImmutability = () => {
		if (guard === "immutable") {
			throw new TypeError("headers are immutable")
		}
	}

	const has = (name) => map.has(normalizeName(name))

	const get = (name) => {
		name = normalizeName(name)
		return map.has(name) ? map.get(name)[0] : null
	}

	const getAll = (name) => {
		name = normalizeName(name)
		return map.has(name) ? this.map.get(name) : []
	}

	const set = (name, value) => {
		checkImmutability()

		name = normalizeName(name)
		value = normalizeValue(value)
		map.set(name, [value])
	}

	const append = (name, value) => {
		checkImmutability()

		name = normalizeName(name)
		value = normalizeValue(value)

		let values

		if (map.has(name)) {
			values = map.get(name)
		} else {
			values = []
		}

		values.push(value)
		map.set(name, values)
	}

	const combine = (name, value) => {
		if (map.has(name)) {
			value = `, ${normalizeValue(value)}`
		}

		return append(name, value)
	}

	const remove = (name) => {
		checkImmutability()

		name = normalizeName(name)
		return map.delete(name)
	}

	const entries = () => map.entries()

	const keys = () => map.keys()

	const values = () => map.values()

	const forEach = (fn, bind) => {
		for (const [headerName, headerValues] of map) {
			headerValues.forEach(function(headerValue) {
				fn.call(bind, headerName, headerValue)
			})
		}
	}

	const toString = () => {
		const headers = []

		for (const [headerName, headerValues] of map) {
			headers.push(`${headerName}: ${headerValues.join()}`)
		}

		return headers.join("\r\n")
	}

	const toJSON = () => {
		const headers = {}

		for (const [headerName, headerValues] of map) {
			headers[headerName] = headerValues
		}

		return headers
	}

	if (headers) {
		if (typeof headers === "string") {
			headers = parseHeaders(headers)
		} else if (typeof headers === "object") {
			// eslint-disable-next-line guard-for-in
			for (const name in headers) {
				append(name, headers[name])
			}
		}
	}

	return {
		has,
		get,
		getAll,
		set,
		append,
		combine,
		["delete"]: remove,
		[Symbol.iterator]: map[Symbol.iterator],
		entries,
		keys,
		values,
		forEach,
		toString,
		toJSON,
	}
}

export const test = {
	modules: ["@node/assert"],

	main(assert) {
		this.add("create with headers", function() {
			var headers = {
				"content-length": 10,
			}

			var headersA = Headers.create(headers)
			var headersB = Headers.create(headersA)

			assert.equal(headersB.has("content-length"), true)
		})

		this.add("toJSON", function() {
			var headers = {
				foo: ["bar"],
			}

			assert.deepEqual(Headers.create(headers).toJSON(), headers)
		})

		this.add("get", function() {
			var headersMap = {
				foo: "bar",
			}
			var headers = Headers.create(headersMap)

			assert.equal(headers.get("foo"), "bar")
		})
	},
}

export default Headers
