import { listenRequest } from "./listen_request.js";
import { asReasonPhrase } from "./reason_phrase.js";

export const trackServerPendingRequests = (nodeServer) => {
  const pendingClients = new Set();

  const removeRequestListener = listenRequest(
    nodeServer,
    (nodeRequest, nodeResponse) => {
      const client = { nodeRequest, nodeResponse };
      pendingClients.add(client);
      nodeResponse.once("close", () => {
        pendingClients.delete(client);
      });
    },
  );

  const stop = async ({ status, reason }) => {
    removeRequestListener();
    const pendingClientsArray = Array.from(pendingClients);
    pendingClients.clear();
    await Promise.all(
      pendingClientsArray.map(({ nodeRequest, nodeResponse }) => {
        if (nodeResponse.headersSent === false) {
          if (nodeRequest.stream) {
            // http2 has no reason phrase
            nodeResponse.writeHead(status);
          } else {
            nodeResponse.writeHead(status, asReasonPhrase(reason));
          }
        }
        return new Promise((resolve) => {
          if (nodeResponse.destroyed) {
            resolve();
            return;
          }
          nodeResponse.once("close", () => {
            resolve();
          });
          nodeResponse.destroy();
        });
      }),
    );
  };

  return { stop };
};
