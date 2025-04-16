import { observableFromNodeStream } from "@jsenv/server/src/interfacing_with_node/observable_from_node_stream.js";

export const fetchUsingNodeRequest = async (
  url,
  { signal, method = "GET", headers = {}, body, path, ignoreHttpsError } = {},
) => {
  let createNodeRequest;
  if (url.startsWith("http:")) {
    const { request } = await import("node:http");
    createNodeRequest = request;
  } else {
    const { request } = await import("node:https");
    createNodeRequest = request;
  }

  const urlObject = new URL(url);
  const { port, hostname } = urlObject;
  const options = {
    signal,
    hostname,
    port,
    method,
    headers: {
      ...(body ? { "content-length": Buffer.byteLength(body) } : {}),
      ...headers,
    },
    path: path || urlObject.pathname,
  };
  if (ignoreHttpsError && url.startsWith("https")) {
    const { Agent } = await import("node:https");
    options.agent = new Agent({
      rejectUnauthorized: false,
    });
  }

  const nodeRequest = createNodeRequest(options);
  if (body) {
    nodeRequest.write(body);
  }
  nodeRequest.end();

  const nodeResponse = await new Promise((resolve, reject) => {
    nodeRequest.on("error", (error) => {
      console.error(`error event triggered on request to ${url}`);
      reject(error);
    });
    nodeRequest.on("response", (nodeResponse) => {
      resolve(nodeResponse);
    });
  });
  const responseBody = observableFromNodeStream(nodeResponse);
  // ideally we would not wait for the response to return a response object
  // for now I can't make node.fetch + Response + all things work together here
  // and this util is not used in production so it's good enough for now
  const responseBodyBuffer = await new Promise((resolve, reject) => {
    const bufferArray = [];
    responseBody.subscribe(
      {
        next: (data) => {
          bufferArray.push(data);
        },
        error: (value) => {
          reject(value);
        },
        complete: () => {
          resolve(Buffer.concat(bufferArray));
        },
      },
      { signal },
    );
  });

  return {
    url,
    status: nodeResponse.statusCode,
    statusText: nodeResponse.statusMessage,
    headers: new Map(Object.entries(nodeResponse.headers)),
    body: responseBodyBuffer,
    arrayBuffer: async () => {
      return responseBodyBuffer;
    },
    text: async () => {
      const responseBodyString = responseBodyBuffer.toString();
      return responseBodyString;
    },
    json: async () => {
      const responseBodyString = responseBodyBuffer.toString();
      const responseBodyJSON = JSON.parse(responseBodyString);
      return responseBodyJSON;
    },
  };
};
