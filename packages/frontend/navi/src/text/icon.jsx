import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Text } from "./text.jsx";
import { TextAnchor } from "./text_anchor.jsx";

const css = /* css */ `
  @layer navi {
    /* Ensure data attributes from box.jsx can win to update display */
    .navi_icon {
      display: inline-flex;
      box-sizing: border-box;
      max-width: 100%;
      /* An icon never grows past the box it sits in, so a glyph can never make
         a line of text taller than the text itself. lineOverflow="allow" opts
         out, for an icon that is an affordance rather than a character — a
         control's chevron or clear button, sized to be touched, not read. */
      max-height: 100%;

      &[data-line-overflow="allow"] {
        max-height: none;
      }
    }
  }

  .navi_icon {
    white-space: nowrap;
    vertical-align: inherit;

    &[data-icon-char] {
      aspect-ratio: 1/1;
      min-width: 0;
      height: round(1em, 1px);
      max-height: round(1em, 1px);
      flex-grow: 0 !important;
      align-items: center;
      justify-content: center;

      /* fillLine: measured on the line box (1lh) instead of the character box
         (1em). The icon still stays inside the line — it just uses all of it,
         which is what an icon standing on its own in a control's slot wants,
         where a glyph sitting among letters wants to match their size. */
      &[data-fill-line] {
        height: round(1lh, 1px);
        max-height: round(1lh, 1px);
      }

      svg,
      img {
        width: 100%;
        height: 100%;
      }
      svg {
        overflow: visible;
      }
    }
    &[data-flow-inline] {
      width: 1em;
      height: 1em;
    }
    &[data-interactive] {
      cursor: pointer;
    }
    &[data-icon-text] {
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
  }

  .navi_icon > svg,
  .navi_icon > img {
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
  }
  .navi_icon[data-width-fixed] > svg,
  .navi_icon[data-width-fixed] > img {
    width: 100%;
    height: auto;
  }
  .navi_icon[data-height-fixed] > svg,
  .navi_icon[data-height-fixed] > img {
    width: auto;
    height: 100%;
  }
  .navi_icon[data-width-fixed][data-height-fixed] > svg,
  .navi_icon[data-width-fixed][data-height-fixed] > img {
    width: 100%;
    height: 100%;
  }
`;

/**
 * Renders an icon — an inline SVG/emoji/text glyph that inherits the
 * surrounding text's `currentColor` and (by default) its font size, so it sits
 * on the text baseline like a character.
 *
 * Content comes from either `href` (references an external/sprite symbol via
 * `<use>`) or `children` (an inline `<svg>` element, or a string for a
 * text/emoji icon). All extra props are spread onto the underlying `Box`/`Text`
 * (sizing, spacing, color, className, data-attributes, …).
 *
 * Render mode is chosen automatically:
 * - `children` is a **string** → a text icon (`<Text data-icon-text>`).
 * - **sized** (an explicit `width`/`height`, or `flex`/`grid`) → a block icon
 *   (`<Box square>`), laid out as its own box rather than inline.
 * - otherwise → an **inline char-like** icon that flows on the text baseline
 *   (`data-icon-char`), aligned via `textAnchor`.
 *
 * Accessibility: an icon is treated as decorative (`aria-hidden`) by default
 * whenever it has no explicit size and no `onClick`; give it an explicit
 * `decorative={false}` (or make it interactive) when it conveys meaning.
 *
 * @param {object} props
 * @param {string} [props.href] - URL/id of an external SVG symbol, rendered via
 *   `<svg><use href></svg>`. Mutually exclusive with meaningful `children`.
 * @param {import("preact").ComponentChildren} [props.children] - Inline icon
 *   content: an `<svg>` element, or a string (renders as a text/emoji icon).
 * @param {boolean} [props.decorative] - Marks the icon `aria-hidden`. Defaults
 *   to `true` for an unsized, non-interactive icon; pass `false` for a
 *   meaning-bearing icon that needs to be exposed to assistive tech.
 * @param {(event: MouseEvent) => void} [props.onClick] - Makes the icon
 *   interactive (`data-interactive`, pointer cursor) and non-decorative.
 * @param {"line-top"|"char-top"|"center"|"char-bottom"|"line-bottom"} [props.textAnchor="center"]
 *   - Vertical alignment within the surrounding text line for the inline
 *   char-like mode, forwarded to `TextAnchor`: `"line-top"`/`"line-bottom"`
 *   align to the line box edges, `"char-top"` to the ink ascent, `"center"`
 *   centers on the line box, `"char-bottom"` sits on the baseline. See
 *   `text_anchor.jsx`.
 * @param {{ size?: number, verticalAlign?: string }} [props.lineLayout] -
 *   Describes the surrounding line context (font size / vertical-align),
 *   forwarded to `TextAnchor` so it recomputes the vertical correction when
 *   that context changes.
 * @param {string|number} [props.width] - Explicit width; `"auto"` clears it.
 *   Any explicit size switches the icon to block (sized) mode.
 * @param {string|number} [props.height] - Explicit height; `"auto"` clears it.
 * @param {"allow"} [props.lineOverflow] - `"allow"` lets the icon be taller
 *   than the box it sits in (a line of text, a control's slot) instead of being
 *   capped by it. For an icon that is an affordance sized for the finger rather
 *   than a character sized for reading.
 * @param {boolean} [props.fillLine] - Sizes the icon on the line box (1lh)
 *   rather than on the character box (1em), so it uses the full height of the
 *   line without leaving it. Unlike `lineOverflow`, the icon still never
 *   exceeds the line.
 * @param {boolean} [props.square] - Keep a 1:1 box; combined with one explicit
 *   dimension it fixes the other too.
 * @param {boolean} [props.circle] - Like `square`, plus a circular shape.
 * @param {string|number} [props.aspectRatio] - Fixes the second dimension from
 *   the one explicit dimension.
 * @param {"x"|"y"|boolean} [props.flex] - Forces block/flex layout; auto-set to
 *   `"x"` when the icon is sized.
 * @param {boolean} [props.grid] - Forces block/grid layout.
 * @param {string} [props.className] - Merged with the base `"navi_icon"` class.
 */
export const Icon = ({
  href,
  children,
  decorative,
  onClick,
  textAnchor = "center",
  lineLayout,
  lineOverflow,
  fillLine,
  ...props
}) => {
  import.meta.css = css;

  const innerChildren = href ? (
    <svg width="100%" height="100%">
      <use href={href} />
    </svg>
  ) : (
    children
  );

  let { flex, grid, width, height } = props;
  if (width === "auto") {
    width = undefined;
  }
  if (height === "auto") {
    height = undefined;
  }
  const hasExplicitWidth = width !== undefined;
  const hasExplicitHeight = height !== undefined;
  const widthFixed =
    hasExplicitWidth ||
    (hasExplicitHeight && (props.square || props.circle || props.aspectRatio));
  const heightFixed =
    hasExplicitHeight ||
    (hasExplicitWidth && (props.square || props.circle || props.aspectRatio));
  if (widthFixed || heightFixed) {
    if (flex === undefined) {
      flex = "x";
    }
  } else if (decorative === undefined && !onClick) {
    decorative = true;
  }
  const ariaProps = decorative ? { "aria-hidden": "true" } : {};
  const textRef = useRef();

  if (typeof children === "string") {
    return (
      <Text
        {...props}
        {...ariaProps}
        data-icon-text=""
        data-line-overflow={lineOverflow}
        data-fill-line={fillLine ? "" : undefined}
      >
        {children}
      </Text>
    );
  }

  if (flex || grid) {
    return (
      <Box
        square
        {...props}
        {...ariaProps}
        flex={flex}
        baseClassName="navi_icon"
        data-width-fixed={widthFixed ? "" : undefined}
        data-height-fixed={heightFixed ? "" : undefined}
        data-interactive={onClick ? "" : undefined}
        data-line-overflow={lineOverflow}
        data-fill-line={fillLine ? "" : undefined}
        onClick={onClick}
      >
        {innerChildren}
      </Box>
    );
  }

  return (
    <TextAnchor
      childRef={textRef}
      textAnchor={textAnchor}
      textSize={props.size}
      lineLayout={lineLayout}
    >
      <Text
        {...props}
        {...ariaProps}
        className={withPropsClassName("navi_icon", props.className)}
        spacing="pre"
        data-icon-char=""
        data-line-overflow={lineOverflow}
        data-fill-line={fillLine ? "" : undefined}
        data-width-fixed={widthFixed ? "" : undefined}
        data-height-fixed={heightFixed ? "" : undefined}
        data-interactive={onClick ? "" : undefined}
        onClick={onClick}
        ref={textRef}
      >
        <span style="user-select:none">&#8203;</span>
        {innerChildren}
      </Text>
    </TextAnchor>
  );
};
