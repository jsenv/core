/**
 * The content of a `<Box mount="after-paint">`: built right after the first
 * frame that shows the box, unless that frame would show it.
 *
 * The browser paints nothing until the render that builds a page has ended, and
 * what lies below the first screen weighs in that render as much as what is on
 * it. A box marked this way is left empty in that render, then built once the
 * frame is painted — the page-level twin of a list's render window (see
 * `renderBudget` in list.jsx), for a page made of sections.
 *
 * Which boxes lie below the screen is measured, not taken from the caller. The
 * caller cannot know: a taller phone, a profile with nothing in its first
 * section, and the box it marked is on screen. So each box looks where it
 * stands in the animation callbacks of its first frame — laid out, not yet
 * painted — and one the frame would show, or one above it, is built there:
 * content appearing on screen is a pop-in, and content growing ABOVE what is
 * read pushes it down. Marking too much costs a second render in that frame,
 * never a wrong picture.
 *
 * The document put back where it was read is the other frame that shows it.
 * That offset is written by navi (see scroll_restoration.js), and written into
 * a document still missing its bottom it is clamped: the page opens higher than
 * it was left, and the bottom arrives under a page that has already jumped. So
 * whoever writes an arrival's offset builds first the boxes that offset shows
 * (buildDeferredBoxesAbove), in the same task — synchronously, since what comes
 * right after it (the offset, a route travel measuring its window) reads the
 * layout.
 */

import { useLayoutEffect, useState } from "preact/hooks";

import { afterPaint } from "../utils/after_paint.js";
import { flushSyncRendering } from "../utils/flush_sync_rendering.js";

const deferredBoxes = new Set();

export const MountAfterPaint = ({ boxRef, children }) => {
  const [built, setBuilt] = useState(false);
  useLayoutEffect(() => {
    let frame;
    let cancelAfterPaint;
    const stopWaiting = () => {
      deferredBoxes.delete(deferredBox);
      cancelAnimationFrame(frame);
      cancelAfterPaint();
    };
    // The first of the three that come — the offset of an arrival, the frame
    // finding the box on screen, the paint — builds it and cancels the others.
    const deferredBox = {
      getElement: () => boxRef.current,
      build: () => {
        stopWaiting();
        setBuilt(true);
      },
    };
    deferredBoxes.add(deferredBox);
    // Requested before afterPaint's own frame callback, so the box is looked at
    // before that one turns the paint into a build.
    frame = requestAnimationFrame(() => {
      const top = readTopInWindow(boxRef.current);
      if (top !== null && top < window.innerHeight) {
        deferredBox.build();
      }
    });
    cancelAfterPaint = afterPaint(deferredBox.build);
    return stopWaiting;
  }, []);
  return built ? children : null;
};

/**
 * Builds, now, every box still waiting whose top is above `bottom` (in the
 * document's coordinates): what the document will show once scrolled so that
 * `bottom` is the bottom of the screen. Boxes built push those below them
 * further down, so the ones measured above `bottom` are all the ones that can
 * be shown there, and a few more at worst.
 *
 * Renders synchronously, so it must be called outside a Preact commit: a render
 * flushed from a layout effect runs inside the commit still walking the tree.
 */
export const buildDeferredBoxesAbove = (bottom) => {
  if (deferredBoxes.size === 0) {
    return;
  }
  const toBuild = [];
  for (const deferredBox of deferredBoxes) {
    const top = readTopInWindow(deferredBox.getElement());
    if (top !== null && top + window.scrollY < bottom) {
      toBuild.push(deferredBox);
    }
  }
  if (toBuild.length === 0) {
    return;
  }
  flushSyncRendering(() => {
    for (const deferredBox of toBuild) {
      deferredBox.build();
    }
  });
};

// null for a box nothing draws (a closed popup, a hidden tab): no frame shows
// it, wherever the document is.
const readTopInWindow = (element) => {
  if (!element || element.getClientRects().length === 0) {
    return null;
  }
  return element.getBoundingClientRect().top;
};
