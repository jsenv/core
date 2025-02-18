import { parse } from "node:querystring";

export const handleRequestBody = async (request, handlers) => {
  const acceptedContentTypeArray = Object.keys(handlers);
  const contentTypeSelected = pickRequestContentType(
    request,
    acceptedContentTypeArray,
  );
  if (!contentTypeSelected) {
    return createUnsupportedMediaTypeResponse(
      request,
      acceptedContentTypeArray,
    );
  }
  const handler = handlers[contentTypeSelected];
  const requestBody = await getRequestBody(request, contentTypeSelected);
  const response = await handler(requestBody);
  return response;
};

export const pickRequestContentType = (request, acceptedContentTypeArray) => {
  const requestBodyContentType = request.headers["content-type"];
  if (!requestBodyContentType) {
    return null;
  }
  for (const acceptedContentType of acceptedContentTypeArray) {
    if (requestBodyContentType.includes(acceptedContentType)) {
      return acceptedContentType;
    }
  }
  return null;
};

export const createUnsupportedMediaTypeResponse = (
  request,
  acceptedContentTypeArray = [],
) => {
  return {
    status: 415,
    [`accept-${request.method}`]: acceptedContentTypeArray.join(", "),
  };
};

export const getRequestBody = async (request, contentType) => {
  // https://github.com/node-formidable/formidable/tree/master/src/parsers
  if (contentType === "multipart/form-data") {
    const { formidable } = await import("formidable");
    const form = formidable({});
    request.__nodeRequest.resume(); // was paused in start_server.js
    const [fields, files] = await form.parse(request.__nodeRequest);
    const requestBodyFormData = { fields, files };
    return requestBodyFormData;
  }
  if (contentType === "application/x-www-form-urlencoded") {
    const requestBodyBuffer = await readRequestBody(request);
    const requestBodyString = String(requestBodyBuffer);
    const requestBodyQueryStringParsed = parse(requestBodyString);
    return requestBodyQueryStringParsed;
  }
  if (contentType === "application/json") {
    const requestBodyBuffer = await readRequestBody(request);
    const requestBodyString = String(requestBodyBuffer);
    const requestBodyJSON = JSON.parse(requestBodyString);
    return requestBodyJSON;
  }
  if (contentType === "text/plain") {
    const requestBodyBuffer = await readRequestBody(request);
    const requestBodyString = String(requestBodyBuffer);
    return requestBodyString;
  }
  if (contentType === "application/octet-stream") {
    const requestBodyBuffer = await readRequestBody(request);
    return requestBodyBuffer;
  }
  throw new Error(`unknown content type ${contentType}`);
};

// exported for unit tests
export const readRequestBody = (request, { as }) => {
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
