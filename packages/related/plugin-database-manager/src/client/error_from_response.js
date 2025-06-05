export const errorFromResponse = async (response, message) => {
  const serverErrorInfo = await response.json();
  let serverMessage =
    typeof serverErrorInfo === "string"
      ? serverErrorInfo
      : serverErrorInfo.message;
  let errorMessage = message ? `${message}: ${serverMessage}` : serverMessage;
  const error = new Error(errorMessage);
  if (serverErrorInfo && typeof serverErrorInfo === "object") {
    error.stack = serverErrorInfo.stack || serverErrorInfo.message;
  }
  error.status = response.status;
  throw error;
};
