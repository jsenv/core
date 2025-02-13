import { fetchUrl } from "@jsenv/fetch";

export const GET = ({ url, githubToken, headers }) => {
  return sendHttpRequest({
    url,
    method: "GET",
    headers: {
      ...tokenToHeaders(githubToken),
      "accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...headers,
    },
    responseStatusHandlers: {
      200: async (response) => {
        const json = await response.json();
        return json;
      },
      404: () => null,
    },
  });
};

export const POST = ({ url, body, githubToken, headers }) => {
  return sendHttpRequest({
    url,
    method: "POST",
    headers: {
      ...tokenToHeaders(githubToken),
      "accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...headers,
    },
    body: JSON.stringify(body),
    responseStatusHandlers: {
      201: async (response) => {
        const json = await response.json();
        return json;
      },
    },
  });
};

export const PATCH = ({ signal, url, body, githubToken, headers }) => {
  return sendHttpRequest({
    signal,
    url,
    method: "PATCH",
    headers: {
      ...tokenToHeaders(githubToken),
      "accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...headers,
    },
    body: JSON.stringify(body),
    responseStatusHandlers: {
      200: async (response) => {
        const json = await response.json();
        return json;
      },
    },
  });
};

const tokenToHeaders = (token) => {
  if (!token) {
    throw new Error(`missing token, request will not be authorized.`);
  }
  return {
    authorization: `token ${token}`,
  };
};

const sendHttpRequest = async ({
  signal,
  url,
  method,
  headers,
  body,
  responseStatusHandlers = {},
}) => {
  let response;
  try {
    response = await fetchUrl(url, {
      signal,
      method,
      headers: {
        ...(typeof body === "undefined"
          ? {}
          : { "content-length": Buffer.byteLength(body) }),
        ...headers,
      },
      body,
    });
  } catch (error) {
    throw new Error(`network error during request.
--- request method ---
${method}
--- request url ---
${url}
--- error stack ---
${error.stack}`);
  }

  const { status } = response;
  const responseStatusHandler = responseStatusHandlers[status];
  if (responseStatusHandler) {
    return responseStatusHandler(response);
  }
  const responseBodyAsJson = await response.json();
  const error = new Error(`unexpected response status.
--- response status ---
${response.status}
--- response statusText ---
${response.statusText}
--- expect response status ---
${Object.keys(responseStatusHandlers).join(", ")}
--- request method ---
${method}
--- request url ---
${url}
--- response json ---
${(JSON.stringify(responseBodyAsJson), null, "  ")}`);
  error.responseStatus = status;
  throw error;
};
