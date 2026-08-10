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
 * 4. **Its hairline is a box-shadow, not a border.** `size` is the bar's
 *    content box, so the safe-area padding can add outside it and the reserve
 *    can be that same variable plus that same inset — nothing counted twice.
 *    A real border would join that total and put the reserve off by its width;
 *    a box-shadow draws the identical line and stays out of layout.
 */

import { useLayoutEffect } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { FIXED_BAR_SPACE_CSS, setFixedBarSpace } from "./fixed_bar_space.js";

const css = /* css */ `
  @layer navi {
    :root {
      --navi-fixed-bar-size: 56px;
      --navi-fixed-bar-max-width: none;
      --navi-fixed-bar-background: var(--navi-surface-color);
      --navi-fixed-bar-border-width: 1px;
      --navi-fixed-bar-border-color: var(--navi-separator-color-default);
    }
  }

  ${FIXED_BAR_SPACE_CSS}

  .navi_fixed_bar {
    position: fixed;
    z-index: 1;
    display: flex;
    /* content-box against an app that is border-box everywhere else: "size"
       stays the bare variable and the safe-area padding adds OUTSIDE it, so
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
      width: 100%;
      max-width: var(--navi-fixed-bar-max-width);
      height: var(--navi-fixed-bar-size);
    }
    &[data-area="left"],
    &[data-area="right"] {
      top: 0;
      bottom: 0;
      width: var(--navi-fixed-bar-size);
      height: 100%;
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

// Written into the element's own style rather than handed to Box as style
// props: several of these names already mean something else to a Box ("size"
// is its font size), and a bar's size is its thickness on whichever axis it
// sits — a meaning only this component can give them.
const FIXED_BAR_CSS_VARS = {
  size: "--navi-fixed-bar-size",
  maxWidth: "--navi-fixed-bar-max-width",
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
 *   size?: string|number,
 *   maxWidth?: string|number,
 *   background?: string,
 *   border?: boolean,
 *   borderWidth?: string|number,
 *   borderColor?: string,
 * }>}
 * @param {"top"|"bottom"|"left"|"right"} [props.area="top"] - Which edge of
 *   the window it is pinned to. `size` is its height on top/bottom, its width
 *   on left/right.
 * @param {string|number} [props.size] - The bar's own size, safe-area inset
 *   NOT included — the inset is added outside it, and the reserve is the sum.
 * @param {boolean} [props.border=true] - The hairline on the content side.
 *   Drawn with a box-shadow so it never joins the reserve arithmetic; give it
 *   a `borderWidth`/`borderColor`, or `border={false}` for none.
 * @param {string|number} [props.maxWidth] - Keeps the bar lined up with a
 *   content column narrower than the window (it stays centered).
 */
export const FixedBar = ({
  children,
  area = "top",
  size,
  maxWidth,
  background,
  borderWidth,
  borderColor,
  border = true,
  style,
  ...props
}) => {
  import.meta.css = css;

  const ownStyle = { ...style };
  const setVar = (name, value) => {
    if (value !== undefined) {
      ownStyle[FIXED_BAR_CSS_VARS[name]] = withPixelUnit(value);
    }
  };
  setVar("size", size);
  setVar("maxWidth", maxWidth);
  setVar("background", background);
  setVar("borderWidth", borderWidth);
  setVar("borderColor", borderColor);

  // The reserve is published on <html>, where a `size` given as a prop — set
  // on the bar itself — would not be readable: it has to be the expression,
  // not the variable. Falling back to the variable keeps the reserve following
  // an app that themes the size globally.
  const sizeExpression = withPixelUnit(size) || "var(--navi-fixed-bar-size)";
  useLayoutEffect(() => {
    // A CSS expression rather than a measured number: whatever moves the bar
    // moves the reserve with it, with nothing to recompute.
    return setFixedBarSpace(
      area,
      `calc(${sizeExpression} + ${SAFE_AREA_INSET[area]})`,
    );
  }, [area, sizeExpression]);

  return (
    <Box
      baseClassName="navi_fixed_bar"
      data-area={area}
      data-border={border ? undefined : "none"}
      style={ownStyle}
      {...props}
    >
      {children}
    </Box>
  );
};

// A bare number in a CSS var stays a bare number and the declaration is
// dropped; every length prop here is in pixels when it is not spelled out.
const withPixelUnit = (value) => {
  if (typeof value === "number") {
    return `${value}px`;
  }
  return value;
};
