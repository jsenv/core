import { useCallback, useEffect, useRef, useState } from "preact/hooks";

/**
 * Copies a text to the clipboard, and says for a moment that it did — the
 * mechanics without a shape: whatever the screen draws (a Button, a link, a
 * row) presses `copy` and shows `copied`.
 *
 * ```jsx
 * const [copied, copy] = useCopyToClipboard(link);
 * <Button action={copy}>{copied ? i18n("Copied") : i18n("Copy link")}</Button>
 * ```
 *
 * `copy` rejects when the browser refuses the write, so an `action` running it
 * says why on the control. A press while `copied` holds starts the moment
 * again.
 *
 * @param {string | (() => string | Promise<string>)} text What is copied. A
 *   function is called at the press: for a text only built then (a report, a
 *   link asked from the server). A promise it returns is handed to the
 *   clipboard as it is, so Safari keeps the gesture the write belongs to.
 * @param {{ duration?: number }} [options]
 * @param {number} [options.duration=1500] How long `copied` stays true, in
 *   milliseconds.
 * @returns {[boolean, () => Promise<void>]} `[copied, copy]`
 */
export const useCopyToClipboard = (text, { duration = 1500 } = {}) => {
  const [copied, setCopied] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;
  const timeoutRef = useRef();
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutRef.current);
    };
  }, []);
  const copy = useCallback(async () => {
    await writeToClipboard(textRef.current);
    if (!mountedRef.current) {
      return;
    }
    clearTimeout(timeoutRef.current);
    setCopied(true);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
    }, duration);
  }, [duration]);
  return [copied, copy];
};

const writeToClipboard = async (text) => {
  const value = typeof text === "function" ? text() : text;
  if (typeof value === "string") {
    await window.navigator.clipboard.writeText(value);
    return;
  }
  // A text still to come: the write starts now, inside the press — Safari
  // refuses one started once the gesture is over — and the clipboard waits
  // for the promise.
  const clipboardItem = new ClipboardItem({
    "text/plain": Promise.resolve(value).then(
      (resolvedText) =>
        new Blob([String(resolvedText)], { type: "text/plain" }),
    ),
  });
  await window.navigator.clipboard.write([clipboardItem]);
};
