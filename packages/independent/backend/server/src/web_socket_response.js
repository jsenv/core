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

export class WebSocketResponse {
  constructor(
    webSocketHandler,
    {
      status = 101,
      statusText = status === 101 ? "Switching Protocols" : undefined,
      headers,
    } = {},
  ) {
    const webSocketHandlerAsBody = {
      [webSocketHandlerAsBodySymbol]: true,
      webSocketHandler,
    };
    const webSocketResponse = {
      status,
      statusText,
      headers,
      body: webSocketHandlerAsBody,
    };
    // eslint-disable-next-line no-constructor-return
    return webSocketResponse;
  }
}

export const isWebSocketResponse = (responseProperties) => {
  return Boolean(responseProperties.body[webSocketHandlerAsBodySymbol]);
};

export const getWebSocketHandler = (responseProperties) => {
  const webSocketHandlerAsBody =
    responseProperties.body[webSocketHandlerAsBodySymbol];
  return webSocketHandlerAsBody
    ? webSocketHandlerAsBody.webSocketHandler
    : undefined;
};

const webSocketHandlerAsBodySymbol = Symbol.for("web_socket_handler_as_body");
