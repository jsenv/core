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
    options.agent = () => {
      return new Agent({
        rejectUnauthorized: false,
      });
    };
  }

  const nodeRequest = createNodeRequest(options);
  if (body) {
    nodeRequest.write(body);
  }
  nodeRequest.end();

  let responseBodyBufferPromise;
  const nodeResponse = await new Promise((resolve, reject) => {
    nodeRequest.on("error", (error) => {
      console.error(`error event triggered on request to ${url}`);
      reject(error);
    });
    nodeRequest.on("response", (nodeResponse) => {
      responseBodyBufferPromise = new Promise((resolve, reject) => {
        const bufferArray = [];
        nodeResponse.on("error", (e) => {
          reject(e);
        });
        nodeResponse.on("data", (chunk) => {
          bufferArray.push(chunk);
        });
        nodeResponse.on("end", () => {
          const bodyBuffer = Buffer.concat(bufferArray);
          resolve(bodyBuffer);
        });
      });
      resolve(nodeResponse);
    });
  });

  return {
    url,
    status: nodeResponse.statusCode,
    statusText: nodeResponse.statusMessage,
    headers: new Map(Object.entries(nodeResponse.headers)),
    arrayBuffer: async () => {
      const responseBodyBuffer = await responseBodyBufferPromise;
      return responseBodyBuffer;
    },
    text: async () => {
      const responseBodyBuffer = await responseBodyBufferPromise;
      return responseBodyBuffer.toString();
    },
    json: async () => {
      const responseBodyBuffer = await responseBodyBufferPromise;
      const responseBodyString = responseBodyBuffer.toString();
      return JSON.parse(responseBodyString);
    },
  };
};
