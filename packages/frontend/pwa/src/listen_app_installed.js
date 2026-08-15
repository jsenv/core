/**
 * Calls `callback` when the app gets installed (the browser "appinstalled"
 * event). It fires whether the user installed from the browser toolbar or
 * accepted a prompt triggered by `addToHomescreen.prompt()`.
 * Returns a function removing the listener.
 *
 * @param {Function} callback
 * @returns {Function} stop listening
 */
export const listenAppInstalled = (callback) => {
  window.addEventListener("appinstalled", callback);
  return () => {
    window.removeEventListener("appinstalled", callback);
  };
};
