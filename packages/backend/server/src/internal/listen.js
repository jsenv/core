import { Abort } from "@jsenv/abort";
import { createServer } from "node:net";

const listen = async ({
  signal = new AbortController().signal,
  server,
  port,
  portHint,
  hostname,
}) => {
  const listeningOperation = Abort.startOperation();

  try {
    listeningOperation.addAbortSignal(signal);

    if (portHint) {
      listeningOperation.throwIfAborted();
      port = await findFreePort(portHint, {
        signal: listeningOperation.signal,
        hostname,
      });
    }
    listeningOperation.throwIfAborted();
    port = await startListening({ server, port, hostname });
    listeningOperation.addAbortCallback(() => stopListening(server));
    listeningOperation.throwIfAborted();

    return port;
  } finally {
    await listeningOperation.end();
  }
};

/**
 * Find a port nobody listens to on the given hostname, trying `initialPort`
 * first then the following ones.
 *
 * @param {number} [initialPort=1] - First port to try.
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {string} [options.hostname="127.0.0.1"] - Interface the port must be free on.
 * @param {number} [options.min=1]
 * @param {number} [options.max=65534] - Give up (throw) past this port.
 * @param {(port: number) => number} [options.next] - How to pick the next port to try.
 * @returns {Promise<number>}
 */
export const findFreePort = async (
  initialPort = 1,
  {
    signal = new AbortController().signal,
    hostname = "127.0.0.1",
    min = 1,
    max = 65534,
    next = (port) => port + 1,
  } = {},
) => {
  const findFreePortOperation = Abort.startOperation();
  try {
    findFreePortOperation.addAbortSignal(signal);
    findFreePortOperation.throwIfAborted();

    const testUntil = async (port, host) => {
      findFreePortOperation.throwIfAborted();
      const free = await portIsFree(port, host);
      if (free) {
        return port;
      }

      const nextPort = next(port);
      if (nextPort > max) {
        throw new Error(
          `${hostname} has no available port between ${min} and ${max}`,
        );
      }
      return testUntil(nextPort, hostname);
    };
    const freePort = await testUntil(initialPort, hostname);
    return freePort;
  } finally {
    await findFreePortOperation.end();
  }
};

const portIsFree = async (port, hostname) => {
  const server = createServer();

  try {
    await startListening({
      server,
      port,
      hostname,
    });
  } catch (error) {
    if (error && error.code === "EADDRINUSE") {
      return false;
    }
    if (error && error.code === "EACCES") {
      return false;
    }
    throw error;
  }

  await stopListening(server);
  return true;
};

const startListening = ({ server, port, hostname }) => {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      // in case port is 0 (randomly assign an available port)
      // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
      resolve(server.address().port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, hostname);
  });
};

export const stopListening = (server) => {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener("close", onClose);
      reject(error);
    };
    const onClose = () => {
      server.removeListener("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("close", onClose);
    server.close();
  });
};

// unit test exports
export { listen, portIsFree };
