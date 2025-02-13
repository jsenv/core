export const clientControlledResourceService = () => {
  let resolve;
  return {
    handleRequest: async (request) => {
      if (request.pathname === "/__delayed__.js") {
        if (request.method === "POST") {
          if (resolve) {
            resolve();
          }
          return {
            status: 200,
          };
        }
        if (resolve) {
          resolve();
        }
        const promise = new Promise((r) => {
          resolve = r;
        });
        await promise;
        return {
          status: 200,
          body: "",
          headers: {
            "content-length": 0,
          },
        };
      }
      return null;
    },
  };
};
