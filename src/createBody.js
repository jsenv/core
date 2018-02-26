import stream from "stream"
import { createAction } from "@dmail/action"

const isNodeStream = (a) => {
	if (a instanceof stream.Stream || a instanceof stream.Writable) {
		return true
	}
	return false
}

const createTwoWayStream = () => {
	const stream = {}

	const buffers = []
	let length = 0
	const pipes = []
	let status = "opened"

	const action = createAction()

	let storedError
	const error = (e) => {
		status = "errored"
		storedError = e
		pipes.forEach((pipe) => {
			pipe.error(e)
		})
		throw e
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
			} else if (isNodeStream(stream)) {
				stream.end()
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
		action.pass(buffers)
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
		error,
		cancel,
		write,
		close,
		pipeTo,
		tee,
		action,
	})

	return stream
}

const stringToArrayBuffer = (string) => {
	string = String(string)
	const buffer = new ArrayBuffer(string.length * 2) // 2 bytes for each char
	const bufferView = new Uint16Array(buffer)
	let i = 0
	while (i < string.length) {
		bufferView[i] = string.charCodeAt(i)
		i++
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
			// je crois que c'est au cas où le stream est paused ou quoi
			// pour lui indiquer qu'on est intéréssé
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
		return twoWayStream.action.then((buffers) => buffers.join(""))
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

	const pipeTo = (...args) => {
		return twoWayStream.pipeTo(...args)
	}

	return {
		text,
		arraybuffer,
		json,
		pipeTo,
	}
}
