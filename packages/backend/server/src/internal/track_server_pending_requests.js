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
        return new Promise((resolve) => {
          if (nodeResponse.destroyed) {
            resolve();
            return;
          }
          nodeResponse.once("close", () => {
            resolve();
          });
          if (nodeResponse.headersSent) {
            // a status already sent cannot be replaced: the response is cut
            nodeResponse.destroy();
            return;
          }
          if (nodeRequest.stream) {
            // http2 has no reason phrase, nor a connection header
            nodeResponse.writeHead(status);
          } else {
            nodeResponse.writeHead(status, asReasonPhrase(reason), {
              connection: "close",
            });
          }
          nodeResponse.end();
        });
      }),
    );
  };

  return { stop };
};
