import { Box } from "../box/box.jsx";

const css = /* css */ `
  @layer navi {
    .navi_separator {
      --size: 1px;
      --color: var(--navi-separator-color-default);
      --margin: 0.5em;
    }
  }

  .navi_separator {
    width: 100%;
    height: var(--size);
    /* Logical, not top/bottom: "start" is above a horizontal rule and to the
       left of a vertical one, so the same two vars place both. */
    margin-top: var(--margin-start, var(--margin));
    margin-bottom: var(--margin-end, var(--margin));
    flex-shrink: 0;
    background: var(--color);
    border: none;

    &[data-vertical] {
      display: inline-block;

      width: var(--size);
      height: 1lh;
      margin-top: 0;
      margin-right: var(--margin-end, var(--margin));
      margin-bottom: 0;
      margin-left: var(--margin-start, var(--margin));
      vertical-align: bottom;
    }
  }
`;

/**
 * A line between two things. Horizontal by default — a real `<hr>`, so it is a
 * separator to a screen reader too, not a styled div. `vertical` makes it a
 * `<span>` instead: an `<hr>` cannot sit inside a line of text, and what a
 * vertical rule separates is almost always inline (two links in a row, a label
 * and a count).
 *
 * A vertical one is `1lh` tall — the height of the line it sits on, not of
 * whatever contains it — so it matches the text beside it and needs no height
 * of its own whatever the font size around it.
 *
 * Everything about how it looks goes through a CSS var, so it can be set per
 * separator as a prop or once for a whole surface in CSS.
 *
 * @type {import("preact").FunctionComponent<{
 *   vertical?: boolean,
 *   size?: string|number,
 *   color?: string,
 *   margin?: string|number,
 *   marginStart?: string|number,
 *   marginEnd?: string|number,
 * }>}
 * @param {boolean} [props.vertical] - Draw it upright, inline with the text
 *   beside it, instead of across the flow.
 * @param {string|number} [props.size="1px"] - How thick the line is —
 *   `--size`. Its length is not a prop: a horizontal one spans what holds it, a
 *   vertical one matches the line of text it sits on.
 * @param {string} [props.color] - The line's own colour — `--color`.
 * @param {string|number} [props.margin="0.5em"] - Room kept on both sides of
 *   the line — `--margin`.
 * @param {string|number} [props.marginStart] - Room on one side only —
 *   `--margin-start`, above a horizontal rule and left of a vertical one.
 * @param {string|number} [props.marginEnd] - …and the other, `--margin-end`.
 */
export const Separator = ({
  vertical,
  size,
  color,
  margin,
  marginStart,
  marginEnd,
  style,
  ...props
}) => {
  import.meta.css = css;

  return (
    <Box
      as={vertical ? "span" : "hr"}
      {...props}
      data-vertical={vertical ? "" : undefined}
      baseClassName="navi_separator"
      // Written straight into style rather than declared through Box's own
      // styleCSSVars: `size` and `margin` are names Box already owns (a font
      // size, real margins) and it resolves those before it ever looks at
      // styleCSSVars — so size="4px" would set a font size and leave the line
      // as thin as it was. Last, so a caller's own style still wins.
      style={{
        ...cssVars({
          "--size": lengthValue(size),
          "--color": color,
          "--margin": lengthValue(margin),
          "--margin-start": lengthValue(marginStart),
          "--margin-end": lengthValue(marginEnd),
        }),
        ...style,
      }}
    />
  );
};

// Only what was actually passed: an undefined custom property would otherwise
// be written as the string "undefined" and break the var() fallback chain the
// CSS above relies on.
const cssVars = (vars) => {
  const declared = {};
  for (const name of Object.keys(vars)) {
    const value = vars[name];
    if (value !== undefined) {
      declared[name] = value;
    }
  }
  return declared;
};

const lengthValue = (value) =>
  typeof value === "number" ? `${value}px` : value;
