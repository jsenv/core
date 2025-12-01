/**
 * Creates a function that generates abort signals, automatically cancelling previous requests.
 *
 * This prevents race conditions when multiple fetch requests are triggered rapidly,
 * ensuring only the most recent request completes while canceling outdated ones.
 *
 * @param {string} [reason="Request superseded"] - Custom reason for the abort signal
 * @returns {() => AbortSignal} A function that returns a fresh AbortSignal and cancels the previous one
 *
 * @example
 * // Setup the request canceller
 * const cancelPrevious = createRequestCanceller();
 *
 * // Use it in sequential fetch operations
 * const searchUsers = async (query) => {
 *   const signal = cancelPrevious(); // Cancels previous search
 *   const response = await fetch(`/api/users?q=${query}`, { signal });
 *   return response.json();
 * };
 *
 * // Rapid successive calls - only the last one will complete
 * searchUsers("john");  // Will be aborted
 * searchUsers("jane");  // Will be aborted
 * searchUsers("jack");  // Will complete
 *
 * @example
 * // With custom reason
 * const cancelPrevious = createRequestCanceller("Search cancelled");
 */
export const createRequestCanceller = (reason = "Request superseded") => {
  let previousAbortController;
  return () => {
    if (previousAbortController) {
      const abortError = new DOMException(reason, "AbortError");
      abortError.isHandled = true;
      previousAbortController.abort(abortError);
    }
    previousAbortController = new AbortController();
    return previousAbortController.signal;
  };
};
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.isHandled) {
    event.preventDefault(); // 💥 empêche les "uncaught rejection" devtools pour nos cancellations
  }
});
