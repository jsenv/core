export const createServerEventsDispatcher = () => {
  const clients = []
  const MAX_CLIENTS = 100

  const addClient = (client) => {
    clients.push(client)
    if (clients.length >= MAX_CLIENTS) {
      const firstClient = clients.shift()
      firstClient.close()
    }
    return () => {
      client.close()
      const index = clients.indexOf(client)
      if (index > -1) {
        clients.splice(index, 1)
      }
    }
  }

  return {
    addWebsocket: (websocket, request) => {
      const client = {
        request,
        getReadystate: () => {
          return websocket.readyState
        },
        sendEvent: (event) => {
          websocket.send(JSON.stringify(event))
        },
        close: (reason) => {
          const closePromise = new Promise((resolve, reject) => {
            websocket.onclose = () => {
              websocket.onclose = null
              websocket.onerror = null
              resolve()
            }
            websocket.onerror = (e) => {
              websocket.onclose = null
              websocket.onerror = null
              reject(e)
            }
          })
          websocket.close(reason)
          return closePromise
        },
        destroy: () => {
          websocket.terminate()
        },
      }
      client.sendEvent({ type: "welcome" })
      return addClient(client)
    },
    // we could add "addEventSource" and let clients connect using
    // new WebSocket or new EventSource
    // in practice the new EventSource won't be used
    // so "serverEventsDispatcher.addEventSource" is not implemented
    // addEventSource: (request) => {},
    dispatch: (event) => {
      clients.forEach((client) => {
        if (client.getReadystate() === 1) {
          client.sendEvent(event)
        }
      })
    },
    dispatchToClientsMatching: (event, predicate) => {
      clients.forEach((client) => {
        if (client.getReadystate() === 1 && predicate(client)) {
          client.sendEvent(event)
        }
      })
    },
    close: async (reason) => {
      await Promise.all(
        clients.map(async (client) => {
          await client.close(reason)
        }),
      )
    },
    destroy: () => {
      clients.forEach((client) => {
        client.destroy()
      })
    },
  }
}
