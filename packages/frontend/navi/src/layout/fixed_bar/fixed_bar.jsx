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
 * 3. **It reaches under the notch.** `env(safe-area-inset-*)` pushes the
 *    content in while the background keeps running to the edge of the screen.
 *    Note that every `env(safe-area-inset-*)` is 0 unless the page asks for
 *    it: `<meta name="viewport" content="…, viewport-fit=cover">`.
 * 4. **Its hairline is a box-shadow, not a border.** `width`/`height` is the
 *    bar's content box, so the safe-area padding can add outside it and the
 *    reserve can be that same value plus that same inset — nothing twice.
 *    A real border would join that total and put the reserve off by its width;
 *    a box-shadow draws the identical line and stays out of layout.
 */

import { useLayoutEffect } from "preact/hooks";

import { stringifyStyle } from "@jsenv/dom";

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
      /* Along the bar only: room so its content never touches the edge of the
         screen. Across it, the size and the safe-area inset already say
         everything — anything added there would throw the reserve off. */
      --navi-fixed-bar-padding: var(--navi-s);
    }
  }

  ${FIXED_BAR_SPACE_CSS}

  .navi_fixed_bar {
    position: fixed;
    z-index: 1;
    display: flex;
    /* content-box against an app that is border-box everywhere else: the size
       stays bare and the safe-area padding adds OUTSIDE it, so
       the total is exactly what fixed_bar_space.js reserves — no
       calc(var + env) written twice. */
    box-sizing: content-box;
    margin: auto;
    align-items: center;
    background: var(--navi-fixed-bar-background);

    &[data-area="top"],
    &[data-area="bottom"] {
      right: 0;
      left: 0;
      /* No width of its own: pinned to both edges, the used width absorbs the
         padding instead of being inflated by it — which a content-box
         "width: 100%" would do. max-width then narrows it and the auto
         margins re-center it. */
      max-width: var(--navi-fixed-bar-max-width);
      height: var(--navi-fixed-bar-height);
      padding-right: var(--navi-fixed-bar-padding);
      padding-left: var(--navi-fixed-bar-padding);
    }
    &[data-area="left"],
    &[data-area="right"] {
      top: 0;
      bottom: 0;
      width: var(--navi-fixed-bar-width);
      padding-top: var(--navi-fixed-bar-padding);
      padding-bottom: var(--navi-fixed-bar-padding);
      flex-direction: column;
    }

    /* The inset on this edge alone: the one the bar is pinned to. */
    &[data-area="top"] {
      top: 0;
      padding-top: env(safe-area-inset-top);
      box-shadow: 0 var(--navi-fixed-bar-border-width) 0
        var(--navi-fixed-bar-border-color);
    }
    &[data-area="bottom"] {
      bottom: 0;
      padding-bottom: env(safe-area-inset-bottom);
      box-shadow: 0 calc(-1 * var(--navi-fixed-bar-border-width)) 0
        var(--navi-fixed-bar-border-color);
    }
    &[data-area="left"] {
      left: 0;
      padding-left: env(safe-area-inset-left);
      box-shadow: var(--navi-fixed-bar-border-width) 0 0
        var(--navi-fixed-bar-border-color);
    }
    &[data-area="right"] {
      right: 0;
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
  maxWidth: "--navi-fixed-bar-max-width",
  padding: "--navi-fixed-bar-padding",
  background: "--navi-fixed-bar-background",
  borderWidth: "--navi-fixed-bar-border-width",
  borderColor: "--navi-fixed-bar-border-color",
};

const SAFE_AREA_INSET = {
  top: "env(safe-area-inset-top)",
  bottom: "env(safe-area-inset-bottom)",
  left: "env(safe-area-inset-left)",
  right: "env(safe-area-inset-right)",
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
 *   inset is NOT included in it: the inset is added outside, and the reserve is
 *   the sum of the two.
 * @param {boolean} [props.border=true] - The hairline on the content side.
 *   Drawn with a box-shadow so it never joins the reserve arithmetic; give it
 *   a `borderWidth`/`borderColor`, or `border={false}` for none.
 * @param {string|number} [props.maxWidth] - Keeps the bar lined up with a
 *   content column narrower than the window (it stays centered).
 */
export const FixedBar = ({
  children,
  area = "top",
  width,
  height,
  border = true,
  ...props
}) => {
  import.meta.css = css;

  // Written as CSS variables in the element's own style rather than handed to
  // Box, which would turn them into a real width/height — the same thing
  // SidePanel does with its own width/height props.
  const widthValue = toCssLength(width, "width");
  const heightValue = toCssLength(height, "height");

  // Whichever of the two crosses the edge the bar sits on is the one the
  // content has to be given back. The reserve is published on <html>, where a
  // variable set on the bar itself would not resolve, so it has to be the
  // value; falling back to the variable keeps the reserve following an app
  // that themes the size globally.
  const vertical = area === "left" || area === "right";
  const sizeValue =
    (vertical ? widthValue : heightValue) ||
    `var(--navi-fixed-bar-${vertical ? "width" : "height"})`;
  useLayoutEffect(() => {
    // A CSS expression rather than a measured number: whatever moves the bar
    // moves the reserve with it, with nothing to recompute.
    return setFixedBarSpace(
      area,
      `calc(${sizeValue} + ${SAFE_AREA_INSET[area]})`,
    );
  }, [area, sizeValue]);

  return (
    <Box
      baseClassName="navi_fixed_bar"
      data-area={area}
      data-border={border ? undefined : "none"}
      {...props}
      style={{
        "--navi-fixed-bar-width": widthValue,
        "--navi-fixed-bar-height": heightValue,
        ...props.style,
      }}
      styleCSSVars={FixedBarStyleCSSVars}
    >
      {children}
    </Box>
  );
};

// The same normalization Box uses for its own length props: bare numbers
// become px, percentages / calc() / keywords pass through untouched.
const toCssLength = (value, propertyName) =>
  value === undefined || value === null
    ? undefined
    : stringifyStyle(value, propertyName);
