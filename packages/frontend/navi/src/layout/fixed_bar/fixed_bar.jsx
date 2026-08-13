/**
 * A strip pinned to one edge of the window, and the space it takes back from
 * the content. What goes in it is none of its business — a nav, a title, a
 * toolbar, an action.
 *
 * The four things it is here to get right, each of which is a trap:
 *
 * 1. **`position: fixed`, never sticky.** A sticky element sticks to its
 *    nearest scrolling ancestor, and an app shell almost always has one (an
 *    `overflow` somewhere) — the bar would then stick inside that box and
 *    never to the window. Fixed, centered and bounded by `maxWidth`, it also
 *    stays lined up with the content on a wide screen.
 * 2. **It gives its space back.** Being fixed it covers the content: without a
 *    reserve the end of a long page stays under it, unreachable. It publishes
 *    what it takes on <html> — see fixed_bar_space.js.
 * 3. **It reaches under the notch.** `env(safe-area-inset-*)` is padding, so
 *    the content is pushed in while the background keeps running to the edge of
 *    the screen. Across the bar that inset is added to `width`/`height` too, so
 *    the size asked for is the size the content gets whatever the device does;
 *    along the bar it adds to the padding asked for. Note that every
 *    `env(safe-area-inset-*)` is 0 unless the page asks for it:
 *    `<meta name="viewport" content="…, viewport-fit=cover">`.
 * 4. **Its hairline is a box-shadow, not a border.** A real border would eat
 *    into the size; a box-shadow draws the identical line and stays out of
 *    layout.
 */

import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { FIXED_BAR_SPACE_CSS, setFixedBarSpace } from "./fixed_bar_space.js";

const css = /* css */ `
  @layer navi {
    :root {
      --navi-fixed-bar-width: 56px;
      --navi-fixed-bar-height: 56px;
      --navi-fixed-bar-max-width: none;
      --navi-fixed-bar-background: var(--navi-surface-color);
      --navi-fixed-bar-border-width: 1px;
      --navi-fixed-bar-border-color: var(--navi-separator-color-default);
      /* Along the bar only — across it there is nothing to add, that direction
         is what the width/height prop names. None by default: a row of items
         sharing the whole strip is as common as a toolbar wanting air at its
         ends, and only the second can ask. */
      --navi-fixed-bar-padding: 0px;
    }
  }

  ${FIXED_BAR_SPACE_CSS}

  .navi_fixed_bar {
    position: fixed;
    z-index: 1;
    display: flex;
    box-sizing: border-box;
    margin: auto;
    align-items: center;
    background: var(--navi-fixed-bar-background);

    /* Along the bar, the two insets that can bite into it there are added to
       the padding asked for: in landscape the notch is on a side, and a top bar
       whose padding ignored it would put its first item under it. */
    &[data-area="top"],
    &[data-area="bottom"] {
      right: 0;
      left: 0;
      /* No width of its own: pinned to both edges, the used width absorbs the
         padding instead of being inflated by it. max-width then narrows it and
         the auto margins re-center it. */
      max-width: var(--navi-fixed-bar-max-width);
      padding-right: calc(
        var(--navi-fixed-bar-padding) + env(safe-area-inset-right)
      );
      padding-left: calc(
        var(--navi-fixed-bar-padding) + env(safe-area-inset-left)
      );
    }
    &[data-area="left"],
    &[data-area="right"] {
      top: 0;
      bottom: 0;
      padding-top: calc(
        var(--navi-fixed-bar-padding) + env(safe-area-inset-top)
      );
      padding-bottom: calc(
        var(--navi-fixed-bar-padding) + env(safe-area-inset-bottom)
      );
      flex-direction: column;
    }

    /* Across the bar, the inset of the edge it is pinned to is padding AND is
       added to the size: the background then runs under the notch while the
       content keeps the whole width/height asked for. */
    &[data-area="top"] {
      top: 0;
      height: calc(var(--navi-fixed-bar-height) + env(safe-area-inset-top));
      padding-top: env(safe-area-inset-top);
      box-shadow: 0 var(--navi-fixed-bar-border-width) 0
        var(--navi-fixed-bar-border-color);
    }
    &[data-area="bottom"] {
      bottom: 0;
      height: calc(var(--navi-fixed-bar-height) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      box-shadow: 0 calc(-1 * var(--navi-fixed-bar-border-width)) 0
        var(--navi-fixed-bar-border-color);
    }
    &[data-area="left"] {
      left: 0;
      width: calc(var(--navi-fixed-bar-width) + env(safe-area-inset-left));
      padding-left: env(safe-area-inset-left);
      box-shadow: var(--navi-fixed-bar-border-width) 0 0
        var(--navi-fixed-bar-border-color);
    }
    &[data-area="right"] {
      right: 0;
      width: calc(var(--navi-fixed-bar-width) + env(safe-area-inset-right));
      padding-right: env(safe-area-inset-right);
      box-shadow: calc(-1 * var(--navi-fixed-bar-border-width)) 0 0
        var(--navi-fixed-bar-border-color);
    }
    &[data-border="none"] {
      box-shadow: none;
    }
  }
`;

const FixedBarStyleCSSVars = {
  // width/height go through the vars the size calc reads: written as plain
  // inline styles they would land on the border box and the safe-area inset
  // would eat into the size asked for.
  width: "--navi-fixed-bar-width",
  height: "--navi-fixed-bar-height",
  maxWidth: "--navi-fixed-bar-max-width",
  padding: "--navi-fixed-bar-padding",
  background: "--navi-fixed-bar-background",
  borderWidth: "--navi-fixed-bar-border-width",
  borderColor: "--navi-fixed-bar-border-color",
};

/**
 * @type {import("preact").FunctionComponent<{
 *   area?: "top"|"bottom"|"left"|"right",
 *   width?: string|number,
 *   height?: string|number,
 *   maxWidth?: string|number,
 *   padding?: string|number,
 *   background?: string,
 *   border?: boolean,
 *   borderWidth?: string|number,
 *   borderColor?: string,
 * }>}
 * @param {"top"|"bottom"|"left"|"right"} [props.area="top"] - Which edge of
 *   the window it is pinned to.
 * @param {string|number} [props.height] - For a bar on the top or bottom
 * @param {string|number} [props.width] - …and for one on a side. The safe-area
 *   inset is NOT part of it: it is added on top, so the content keeps the size
 *   asked for.
 * @param {boolean} [props.border=true] - The hairline on the content side.
 *   Drawn with a box-shadow so it never eats into the size; give it a
 *   `borderWidth`/`borderColor`, or `border={false}` for none.
 * @param {string|number} [props.maxWidth] - Keeps the bar lined up with a
 *   content column narrower than the window (it stays centered).
 */
export const FixedBar = ({
  children,
  area = "top",
  border = true,
  ...props
}) => {
  import.meta.css = css;

  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  // Whichever of width/height crosses the edge the bar sits on is what the
  // content has to be given back — and the bar's border box already IS that:
  // the size it was given plus the inset of that edge. Measured rather than
  // rebuilt as a calc() expression, so a size coming from anywhere — a prop, a
  // theme variable, the content itself — is reserved just the same, and each
  // `env()` inset stays the browser's business alone.
  // And measured again whenever it changes: a ResizeObserver on the bar covers
  // in one go a size prop that changes, content arriving or leaving, a font
  // loading late, a rotation moving the notch.
  const vertical = area === "left" || area === "right";
  const { ref } = props;

  useLayoutEffect(() => {
    const barElement = ref.current;
    if (!barElement) {
      return undefined;
    }
    const publishSize = () => {
      const { width, height } = barElement.getBoundingClientRect();
      setFixedBarSpace(area, barElement, vertical ? width : height);
    };
    publishSize();
    const resizeObserver = new ResizeObserver(publishSize);
    resizeObserver.observe(barElement);
    return () => {
      resizeObserver.disconnect();
      setFixedBarSpace(area, barElement, null);
    };
  }, [area, vertical]);

  return (
    <Box
      baseClassName="navi_fixed_bar"
      data-area={area}
      data-border={border ? undefined : "none"}
      {...props}
      styleCSSVars={FixedBarStyleCSSVars}
    >
      {children}
    </Box>
  );
};
