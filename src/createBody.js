import stream from "stream"

const createTwoWayStream = () => {
	const stream = {}

	const buffers = []
	let length = 0
	const pipes = []
	let status = "opened"

	let resolve
	let reject

	const promise = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})

	let storedError
	const error = (e) => {
		status = "errored"
		storedError = e
		pipes.forEach((pipe) => {
			pipe.error(e)
		})
		reject(e)
	}

	const pipeTo = (
		stream,
		{ preventCancel = false, preventClose = false, preventError = false } = {},
	) => {
		if (status === "cancelled") {
			if (preventCancel) {
				// throw new Error('stream cancelled : it cannot pipeTo other streams')
			} else {
				stream.cancel()
			}

			return stream
		}
		if (status === "errored") {
			if (preventError) {
				//
			} else {
				stream.error(storedError)
			}

			return stream
		}

		pipes.push(stream)
		if (length) {
			buffers.forEach((buffer) => {
				stream.write(buffer)
			})
		}

		if (status === "closed") {
			if (preventClose) {
				//
			} else {
				stream.close()
			}
		}

		return stream
	}

	const write = (data) => {
		buffers.push(data)
		length += data.length
		pipes.forEach((pipe) => {
			pipe.write(data)
		})
	}

	const close = () => {
		pipes.forEach((pipe) => {
			if (pipe.close) {
				pipe.close()
			}
		})
		pipes.length = 0
		status = "closed"
		resolve(buffers)
	}

	const cancel = () => {
		close()
		buffers.length = 0
		length = 0
		status = "cancelled"
	}

	const tee = () => {
		const a = stream
		const b = createTwoWayStream()

		pipeTo(b)

		return [a, b]
	}

	Object.assign(stream, {
		write,
		error,
		cancel,
		pipeTo,
		tee,
		promise,
	})

	return stream
}

const isNodeStream = function(a) {
	if (a instanceof stream.Stream || a instanceof stream.Writable) {
		return true
	}
	return false
}

const stringToArrayBuffer = (string) => {
	string = String(string)
	var buffer = new ArrayBuffer(string.length * 2) // 2 bytes for each char
	var bufferView = new Uint16Array(buffer)
	var i = 0
	var j = string.length
	for (; i < j; i++) {
		bufferView[i] = string.charCodeAt(i)
	}
	return buffer
}

export const createBody = (body) => {
	const twoWayStream = createTwoWayStream()

	const fill = (data) => {
		if (isNodeStream(data)) {
			const nodeStream = data
			const passStream = new stream.PassThrough()

			// pourquoi j'utilise un passtrhough au lieu d'écouter directement les event sdu stream?
			// chais pas, peu importe y'avais surement une bonne raison
			nodeStream.on("error", twoWayStream.error)
			passStream.on("end", twoWayStream.close)
			passStream.on("data", twoWayStream.write)
			nodeStream.pipe(passStream)

			return
		}

		twoWayStream.write(data)
		twoWayStream.close()
	}

	if (body !== undefined) {
		fill(body)
	}

	const readAsString = () => {
		return twoWayStream.promise.then((buffers) => buffers.join(""))
	}

	const text = () => {
		return readAsString()
	}

	const arraybuffer = () => {
		return text().then(stringToArrayBuffer)
	}

	const json = () => {
		return text().then(JSON.parse)
	}

	return {
		text,
		arraybuffer,
		json,
	}
}
