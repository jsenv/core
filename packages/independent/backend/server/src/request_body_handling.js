/*

TODO: a revoir pour ceci:

return handleRequestBody(request, {
  'multipart/form-data': async (formData) => {
  },
  'application/json': async (json) => {
  }
});

// et si pas accepté alors 
return {
    status: 415, // Unsupported Media Type
    'accept-post': 'multipart/form-data, application/json'
  }
*/

import { parse } from "node:querystring";

export const handleRequestBody = async (request, handlers) => {
  const requestBodyContentType = request.headers["content-type"];
  const acceptedContentTypeArray = Object.keys(handlers);
  if (!requestBodyContentType) {
    return {
      status: 415,
      [`accept-${request.method}`]: acceptedContentTypeArray.join(", "),
    };
  }
  let contentTypeChoosed;
  for (const acceptedContentType of acceptedContentTypeArray) {
    if (requestBodyContentType.includes(acceptedContentType)) {
      contentTypeChoosed = acceptedContentType;
      break;
    }
  }
  if (!contentTypeChoosed) {
    return {
      status: 415,
      [`accept-${request.method}`]: acceptedContentTypeArray.join(", "),
    };
  }

  const handler = handlers[contentTypeChoosed];
  const onBodyReady = async (requestBody) => {
    const response = await handler(requestBody);
    return response;
  };

  // https://github.com/node-formidable/formidable/tree/master/src/parsers
  if (contentTypeChoosed === "multipart/form-data") {
    const { formidable } = await import("formidable");
    const form = formidable({});
    request.__nodeRequest.resume(); // was paused in start_server.js
    const [fields, files] = await form.parse(request.__nodeRequest);
    const requestBodyFormData = { fields, files };
    return onBodyReady(requestBodyFormData);
  }
  if (contentTypeChoosed === "application/x-www-form-urlencoded") {
    const requestBodyBuffer = await readRequestBody(request);
    const requestBodyString = String(requestBodyBuffer);
    const requestBodyQueryStringParsed = parse(requestBodyString);
    return onBodyReady(requestBodyQueryStringParsed);
  }
  if (contentTypeChoosed === "application/json") {
    const requestBodyBuffer = await readRequestBody(request);
    const requestBodyString = String(requestBodyBuffer);
    const requestBodyJSON = JSON.parse(requestBodyString);
    return onBodyReady(requestBodyJSON);
  }
  if (contentTypeChoosed === "text/plain") {
    const requestBodyBuffer = await readRequestBody(request);
    const requestBodyString = String(requestBodyBuffer);
    return onBodyReady(requestBodyString);
  }
  if (contentTypeChoosed === "application/octet-stream") {
    const requestBodyBuffer = await readRequestBody(request);
    return onBodyReady(requestBodyBuffer);
  }
  throw new Error(`unknown content type ${contentTypeChoosed}`);
};

// exported for unit tests
export const readRequestBody = (request, { as } = {}) => {
  return new Promise((resolve, reject) => {
    const bufferArray = [];
    request.body.subscribe({
      error: reject,
      next: (buffer) => {
        bufferArray.push(buffer);
      },
      complete: () => {
        const bodyAsBuffer = Buffer.concat(bufferArray);
        if (as === "buffer") {
          resolve(bodyAsBuffer);
          return;
        }
        if (as === "string") {
          const bodyAsString = bodyAsBuffer.toString();
          resolve(bodyAsString);
          return;
        }
        if (as === "json") {
          const bodyAsString = bodyAsBuffer.toString();
          const bodyAsJSON = JSON.parse(bodyAsString);
          resolve(bodyAsJSON);
          return;
        }
      },
    });
  });
};
