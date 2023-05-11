export const readRequestBody = (request, { as = "string" } = {}) => {
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
