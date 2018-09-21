// https://github.com/dmail-old/project/commit/da7d2c88fc8273850812972885d030a22f9d7448
// https://github.com/dmail-old/project/commit/98b3ae6748d461ac4bd9c48944a551b1128f4459

// http://html5doctor.com/server-sent-events/
const stringifySourceEvent = ({ data, type = "message", id, retry }) => {
  const parts = []

  if (retry) {
    parts.push(`retry:${retry}`)
  }

  if (id) {
    parts.push(`id:${id}`)
  }

  if (type !== "message") {
    parts.push(`event:${type}`)
  }

  parts.push(`data:${data}`)

  return `${parts.join("\n")}\n\n`
}

const createEventHistory = ({ limit } = {}) => {
  const events = []
  let removedCount = 0

  const add = (data) => {
    events.push(data)

    if (events.length >= limit) {
      events.shift()
      removedCount++
    }
  }

  const since = (index) => {
    index = parseInt(index)
    if (isNaN(index)) {
      throw new TypeError("history.since() expect a number")
    }
    index -= removedCount
    return index < 0 ? [] : events.slice(index)
  }

  const reset = () => {
    events.length = 0
    removedCount = 0
  }

  return { add, since, reset }
}

// en gros chaque fois au'un client reauest un fichier on le watch
/*
const fileChangedSSE = createSSERoom()
const watchedFiles = new Map()

if (watchedFiles.has(url) === false) {
	const fileWatcher = watchFile(url, () => {
		fileChangedSSE.sendEvent({
			type: 'file-changed',
			data: url
		})
	})

	watchedFiles.set(url, fileChangedSSE)

	// lorsque le serveur se close on fera
	watchedFiles.forEach((closeWatcher) => closeWatcher())
	watchedFiles.reset()
}

// coté serveur, on aura un service qui fera
const isRequestForFileChangedSSE = () => false

if (isRequestForFileChangedSSE(request)) {
	return fileChangedSSE.connect(request.connection)
}
*/
export const createSSERoom = (
  {
    keepaliveDuration = 30000,
    retryDuration = 1000,
    historyLength = 1000,
    maxLength = 100, // max 100 users accepted
  } = {},
) => {
  const connections = new Set()
  const history = createEventHistory(historyLength)
  let lastEventId = 0
  let state = "closed"
  let interval

  const connect = (connection, lastEventId) => {
    if (connections.size > maxLength) {
      return {
        status: 503,
      }
    }
    if (state === "closed") {
      return {
        status: 204,
      }
    }

    connections.add(connection)
    connection.once("close", () => {
      connections.delete(connection)
    })
    // send events which occured between lastEventId & now
    if (lastEventId !== undefined) {
      history.since(lastEventId).forEach((event) => {
        connection.write(stringifySourceEvent(event))
      })
    }

    const joinEvent = {
      type: "join",
      data: new Date(),
      retry: retryDuration,
      id: lastEventId,
    }
    lastEventId++
    history.add(joinEvent)

    return {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
      body: stringifySourceEvent(joinEvent),
    }
  }

  const write = (data) => {
    connections.forEach((connection) => {
      connection.write(data)
    })
  }

  const sendEvent = (event) => {
    if (event.type !== "comment") {
      event.id = lastEventId
      lastEventId++
      history.add(event)
    }

    write(stringifySourceEvent(event))
  }

  const keepAlive = () => {
    sendEvent({
      type: "comment",
      data: new Date(),
    })
  }

  const open = () => {
    interval = setInterval(keepAlive, keepaliveDuration)
    state = "opened"
  }

  const close = () => {
    // it should close every connection no?
    clearInterval(interval)
    history.reset()
    state = "closed"
  }

  return { open, close, connect, sendEvent }
}
