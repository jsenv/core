export const errorFromResponse = async (response, message) => {
  const status = response.status;
  const statusText = response.statusText;
  const responseContentType = response.headers.get("content-type") || "";

  let serverErrorMessage;
  let serverErrorStack;
  if (responseContentType.includes("application/json")) {
    try {
      const serverResponseJson = await response.json();
      if (typeof serverResponseJson === "string") {
        serverErrorMessage = serverResponseJson;
      } else {
        serverErrorMessage =
          serverResponseJson.message || serverResponseJson.stack;
        serverErrorStack = serverResponseJson.stack;
      }
    } catch {
      serverErrorMessage = statusText;
    }
  } else {
    const serverResponseText = await response.text();
    if (serverResponseText) {
      serverErrorMessage = serverResponseText;
    } else {
      serverErrorMessage = statusText;
    }
  }

  const errorMessage = message
    ? `${message}: ${serverErrorMessage}`
    : serverErrorMessage;
  const error = new Error(errorMessage);
  if (serverErrorStack) {
    error.stack = serverErrorStack;
  }
  error.status = status;
  throw error;
};
