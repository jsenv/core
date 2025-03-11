import http from "node:http";

import { Abort } from "@jsenv/abort";

export const startServer = async ({
  signal = new AbortController().signal,
} = {}) => {
  const startServerOperation = Abort.startOperation();
  try {
    startServerOperation.addAbortSignal(signal);

    const server = http.createServer();
    startServerOperation.throwIfAborted();
    const port = await new Promise((resolve, reject) => {
      server.on("error", reject);
      server.on("listening", () => {
        resolve(server.address().port);
      });
      server.listen(0, "127.0.0.1");
    });
    const stop = async (reason) => {
      await new Promise((resolve, reject) => {
        server.once("close", (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(`server closed because ${reason}`);
          }
        });
        server.close();
      });
    };
    startServerOperation.addAbortCallback(stop);
    startServerOperation.throwIfAborted();

    process.on("exit", stop);

    server.on("request", (request, response) => {
      response.writeHead(200);
      response.end();
    });

    return { server, port };
  } finally {
    await startServerOperation.end();
  }
};

export const requestServer = async ({
  signal = new AbortController().signal,
  port,
}) => {
  const fetchOperation = Abort.startOperation();
  try {
    fetchOperation.addAbortSignal(signal);
    fetchOperation.throwIfAborted();

    const request = http.request({
      port,
      hostname: "127.0.0.1",
    });

    let aborting = false;

    const response = await new Promise((resolve, reject) => {
      request.on("response", resolve);
      request.on("error", (error) => {
        // abort may trigger a ECONNRESET error
        if (
          aborting &&
          error &&
          error.code === "ECONNRESET" &&
          error.message === "socket hang up"
        ) {
          return;
        }
        reject(error);
      });

      request.end();
    });

    fetchOperation.throwIfAborted();

    return response;
  } finally {
    await fetchOperation.end();
  }
};
