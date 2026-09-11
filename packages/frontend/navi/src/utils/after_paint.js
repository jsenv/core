/**
 * Calls back once the browser has painted what is committed now.
 *
 * The callbacks of the next frame run before that frame paints, so the call is
 * made from a task queued from inside one — the same way preact schedules
 * useEffect. Unlike an effect, nothing runs this early: preact flushes a
 * component's pending effects as soon as that component renders again, and a
 * re-render before the paint is exactly what a caller waiting for the paint
 * has to survive. A frame not coming at all (a background tab) still answers,
 * late, through the timeout.
 *
 * @returns {() => void} cancel
 */
const FRAME_TIMEOUT_MS = 100;

export const afterPaint = (callback) => {
  let called = false;
  let timeoutId;
  let frameId;
  const onFrame = () => {
    if (called) {
      return;
    }
    called = true;
    clearTimeout(timeoutId);
    cancelAnimationFrame(frameId);
    timeoutId = setTimeout(callback, 0);
  };
  timeoutId = setTimeout(onFrame, FRAME_TIMEOUT_MS);
  frameId = requestAnimationFrame(onFrame);
  return () => {
    called = true;
    clearTimeout(timeoutId);
    cancelAnimationFrame(frameId);
  };
};
