import { Box } from "../box/box.jsx";

const css = /* css */ `
  .navi_surrounding_text_aligner_wrapper {
    display: inline-flex;

    &[data-align="start"] {
      align-items: flex-start;
    }
    &[data-align="center"] {
      align-items: center;
    }
    &[data-align="end"] {
      align-items: flex-end;
    }
    &[data-align="baseline"] {
      align-items: baseline;
    }

    .navi_surrounding_text_anchor {
      width: 0;
      user-select: none;
      overflow: hidden;
    }
  }
`;

// SurroundingTextAligner aligns its children vertically relative to the surrounding
// text — independently of the children's own font-size.
//
// Problem: when you place inline content (e.g. a badge, an icon) next to text at a
// different font-size, the browser aligns it using the child's own font metrics, which
// shifts it up or down relative to the surrounding text.
//
// Solution: a zero-width space (&#8203;) is rendered at the *surrounding* text's font-size
// before the children. It participates in the inline line box with the surrounding text's
// ascender/descender metrics, giving inline-flex a stable vertical reference that always
// tracks the surrounding text — regardless of the children's font-size.
//
// The `align` prop controls how children are positioned against that reference:
//   "baseline" (default) — aligns to the surrounding text baseline, most natural for badges/icons next to text
//   "center"             — visual midpoint of the surrounding text line box
//   "start"              — top of the surrounding text line box
//   "end"                — bottom of the surrounding text line box
export const SurroundingTextAligner = ({
  children,
  align = "baseline",
  ...props
}) => {
  import.meta.css = css;

  return (
    <Box
      as="span"
      className="navi_surrounding_text_aligner_wrapper"
      data-align={align}
      {...props}
    >
      <span className="navi_surrounding_text_anchor">&#8203;</span>
      {children}
    </Box>
  );
};
