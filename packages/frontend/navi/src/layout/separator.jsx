import { Box } from "../box/box.jsx";
import { stringifySpacingStyle } from "../box/box_style_util.js";

const css = /* css */ `
  @layer navi {
    .navi_separator {
      --size: 1px;
      --color: var(--navi-separator-color-default);
      --margin: 0.5em;
      --line-style: solid;
      --spacing: 0.5em;
    }
  }

  .navi_separator {
    width: 100%;
    height: 0;
    /* Logical, not top/bottom: "start" is above a horizontal rule and to the
       left of a vertical one, so the same two vars place both. */
    margin-top: var(--margin-start, var(--margin));
    margin-bottom: var(--margin-end, var(--margin));
    flex-shrink: 0;
    /* The line is a border rather than a fill: a border is what takes a style
       (the dotted side of a day label). */
    border: none;
    border-top: var(--size) var(--line-style) var(--color);

    &[data-vertical] {
      display: inline-block;

      width: 0;
      height: 1lh;
      margin-top: 0;
      margin-right: var(--margin-end, var(--margin));
      margin-bottom: 0;
      margin-left: var(--margin-start, var(--margin));
      vertical-align: bottom;
      border-top: none;
      border-left: var(--size) var(--line-style) var(--color);
    }

    /* With a word: a row of lines around it, the row itself drawing nothing. */
    &[data-labelled] {
      display: flex;
      height: auto;
      align-items: center;
      gap: var(--spacing);
      border-top: none;

      > .navi_separator_line {
        flex: 1;
        border-top: var(--size) var(--line-style-start, var(--line-style))
          var(--color);

        &[data-side="end"] {
          border-top-style: var(--line-style-end, var(--line-style));
        }
      }
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
 * Given children, it is a line with a word in it — « ou » between two ways in,
 * a day's label between two days: rule, word, rule. That one is a `<div>` and
 * not an `<hr>`: a separator's content is presentational, and the word has to
 * be read. The lines are hidden from a screen reader and the word is read as
 * the text it is; it takes the surrounding text's look, so a `<Text size
 * color>` child says its own. Horizontal only.
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
 *   lineStyle?: string,
 *   lineStyleStart?: string,
 *   lineStyleEnd?: string,
 *   spacing?: string|number,
 *   labelPosition?: "start" | "center" | "end",
 *   children?: import("preact").ComponentChildren,
 * }>}
 * @param {boolean} [props.vertical] - Draw it upright, inline with the text
 *   beside it, instead of across the flow.
 * @param {string|number} [props.size="1px"] - How thick the line is —
 *   `--size`. Its length is not a prop: a horizontal one spans what holds it, a
 *   vertical one matches the line of text it sits on.
 * @param {string} [props.color] - The line's own colour — `--color`.
 * @param {string|number} [props.margin="0.5em"] - Room kept on both sides of
 *   the line — `--margin`. A spacing word (`"xs"`, `"s"`, `"m"`…), a length or
 *   a number of px, like any margin prop.
 * @param {string|number} [props.marginStart] - Room on one side only —
 *   `--margin-start`, above a horizontal rule and left of a vertical one.
 * @param {string|number} [props.marginEnd] - …and the other, `--margin-end`.
 * @param {string} [props.lineStyle="solid"] - How the line is drawn
 *   (`"dotted"`, `"dashed"`…) — `--line-style`.
 * @param {string} [props.lineStyleStart] - With a word: the line before it
 *   only — `--line-style-start` (the past side of a day label, dotted).
 * @param {string} [props.lineStyleEnd] - …and the line after it,
 *   `--line-style-end`.
 * @param {string|number} [props.spacing="0.5em"] - With a word: the room
 *   between the word and its lines — `--spacing`. A spacing word or a length.
 * @param {"start"|"center"|"end"} [props.labelPosition="center"] - With a
 *   word: where it sits. At an end there is one line only, after the word
 *   (`"start"`) or before it (`"end"`).
 */
export const Separator = ({
  vertical,
  size,
  color,
  margin,
  marginStart,
  marginEnd,
  lineStyle,
  lineStyleStart,
  lineStyleEnd,
  spacing,
  labelPosition = "center",
  style,
  children,
  ...props
}) => {
  import.meta.css = css;

  // Written straight into style rather than declared through Box's own
  // styleCSSVars: `size`, `margin` and `spacing` are names Box already owns (a
  // font size, real margins, a gap) and it resolves those before it ever looks
  // at styleCSSVars — so size="4px" would set a font size and leave the line
  // as thin as it was. Last, so a caller's own style still wins.
  const innerStyle = {
    ...cssVars({
      "--size": lengthValue(size),
      "--color": color,
      "--margin": spacingValue(margin),
      "--margin-start": spacingValue(marginStart),
      "--margin-end": spacingValue(marginEnd),
      "--line-style": lineStyle,
      "--line-style-start": lineStyleStart,
      "--line-style-end": lineStyleEnd,
      "--spacing": spacingValue(spacing),
    }),
    ...style,
  };

  const labelled =
    children !== undefined && children !== null && children !== false;
  if (labelled) {
    if (import.meta.dev && vertical) {
      console.warn(
        "Separator: a word is drawn across a horizontal separator only; `vertical` is ignored.",
      );
    }
    return (
      <Box
        as="div"
        {...props}
        data-labelled=""
        baseClassName="navi_separator"
        style={innerStyle}
      >
        {labelPosition === "start" ? null : (
          <span
            className="navi_separator_line"
            data-side="start"
            aria-hidden="true"
          />
        )}
        <span className="navi_separator_label">{children}</span>
        {labelPosition === "end" ? null : (
          <span
            className="navi_separator_line"
            data-side="end"
            aria-hidden="true"
          />
        )}
      </Box>
    );
  }

  return (
    <Box
      as={vertical ? "span" : "hr"}
      {...props}
      data-vertical={vertical ? "" : undefined}
      baseClassName="navi_separator"
      style={innerStyle}
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
// A margin reads the spacing scale like every other margin prop ("s" →
// var(--navi-s)): written raw, a word is a valid custom property and an invalid
// margin, which computes to 0 without falling back to anything.
const spacingValue = (value) =>
  value === undefined ? undefined : stringifySpacingStyle(value, "margin");
