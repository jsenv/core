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

export const readRequestBody = (request, { as } = {}) => {
  const requestBodyContentType = request.headers["content-type"];
  if (
    requestBodyContentType &&
    requestBodyContentType.includes("multipart/form-data;")
  ) {
    if (as !== undefined && as !== "json") {
      console.warn(`multipart/form-data can be represented only as json.
You must use readRequestBody(request, { as: "json"});`);
    }
    return readRequestBodyFormData(request);
  }
  if (as === undefined) {
    as = "string";
  }
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

const readRequestBodyFormData = async (request) => {
  const { formidable } = await import("formidable");
  const form = formidable({});
  request.__nodeRequest.resume(); // was paused in start_server.js
  const [fields, files] = await form.parse(request.__nodeRequest);
  return { fields, files };
};
