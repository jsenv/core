/**
 * The last moment a document can count on before it may be gone.
 *
 * `pagehide` is not it. It fires when the document is left — a reload, an
 * address typed — and not when the system takes the document away: a tab
 * discarded in the background, a phone reclaiming the memory of an app it put
 * aside. That document saw itself hidden, maybe frozen, and nothing after. So
 * whatever navi keeps for the next document — the address a settling param
 * has not written yet, the scroll positions, the page kept on screen — is
 * written when the document is hidden, frozen, or left, whichever comes:
 * each of these may be the last one.
 *
 * Hidden happens at every tab switch, so what is written then is written
 * often: a write here has to cost what one pass over what is kept costs.
 *
 * @param {() => void} callback
 * @returns {() => void} stops listening
 */
export const whenDocumentMayEnd = (callback) => {
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      callback();
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  // Where the browser freezes a page it may later discard (the Page Lifecycle
  // API); hidden came first, and the write is the same.
  document.addEventListener("freeze", callback);
  window.addEventListener("pagehide", callback);
  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("freeze", callback);
    window.removeEventListener("pagehide", callback);
  };
};
