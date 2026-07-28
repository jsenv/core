/**
 * The standard ways to create a Response
 * - new Response(body, init)
 * - Response.json(data, init)
 * Here we need a way to tell: I want to handle websocket
 * to align with the style of new Response and Response.json to make it look as follow:
 * ```js
 * import { WebSocketResponse } from "@jsenv/server"
 * new WebSocketResponse((websocket) => {
 *   // do stuff with the websocket
 * })
 * ```
 *
 * But we don't really need a class so we are just returning a regular object under the hood
 */

/**
 * Return this from a route `fetch` to accept a websocket upgrade on that
 * endpoint.
 *
 * @param {(websocket: import("ws").WebSocket) => void | (() => void)} webSocketHandler
 *   Called with the raw `ws` socket once the upgrade completes. Use
 *   `websocket.on("message", …)` / `websocket.send(…)`. If it returns a
 *   function, that function runs as cleanup when the socket closes.
 * @param {object} [init]
 * @param {number} [init.status=101]
 * @param {string} [init.statusText]
 * @param {object} [init.headers]
 *
 * @example
 * {
 *   endpoint: "GET /chat.websocket",
 *   fetch: () => new WebSocketResponse((websocket) => {
 *     websocket.on("message", (data) => websocket.send(data));
 *     return () => {
 *       // socket closed
 *     };
 *   }),
 * }
 */
export class WebSocketResponse {
  constructor(
    webSocketHandler,
    {
      status = 101,
      statusText = status === 101 ? "Switching Protocols" : undefined,
      headers,
    } = {},
  ) {
    const webSocketResponse = {
      status,
      statusText,
      headers,
      body: {
        websocket: webSocketHandler,
      },
    };
    // eslint-disable-next-line no-constructor-return
    return webSocketResponse;
  }
}

export const isWebSocketResponse = (responseProperties) => {
  return (
    responseProperties.body &&
    typeof responseProperties.body.websocket === "function"
  );
};

export const getWebSocketHandler = (responseProperties) => {
  const responseBody = responseProperties.body;
  if (!responseBody) {
    return undefined;
  }
  const webSocketHandler = responseBody.websocket;
  return webSocketHandler;
};
