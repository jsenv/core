/**
 * A row or column of controls sharing one frame: the borders where two of them
 * meet are drawn once instead of twice, and only the outer corners stay
 * rounded. See docs/control_group.md.
 */

import { Box } from "@jsenv/navi/src/box/box.jsx";

const css = /* css */ `
  .navi_group {
    --group-border-width: var(--navi-control-border-width);

    /* Two ways of asking for a square corner, and no selector ever reaching
       inside a member:
       - the property, on the member itself: a navi control declares the radius
         of its frame on its own root, and the inner element that draws that
         frame inherits it;
       - the custom property, which travels: a member can be an enrobage (a
         tooltip, a link) around the control that carries the frame, so the ask
         also goes down as --x-corner-*-radius, which a control reads as an
         override of its own radius. Private (the --x- prefix): navi's own
         controls answer it, an app never writes it. Whoever answers it also
         stops it (see .navi_button_content in button_ui.jsx), so a button
         deeper in — the clear cross in a picker's slot, the Save of a form in
         a popup the member opens — never mistakes itself for the seam. */

    /* Members overlap by the width of one border, so along each seam one of the
       two borders covers the other. Whichever member the user is on has to be
       the one on top: it is the one whose border changes color, and the one
       whose focus ring goes all the way around — half a ring, cut by the
       neighbour painted after it, is what this avoids. z-index needs a
       positioned element to mean anything, hence position: relative.
       Deliberately not paired with isolation: isolate — a stacking context
       here would also trap the popup of a picker held in the group, which
       counts on its own band reaching the whole page. What keeps these two
       values from escaping is instead that everything they could reach is a
       band above them (see navi_z_indexes.js). */
    > *:hover,
    > *[data-hover] {
      position: relative;
      z-index: var(--navi-z-index-control-hovered);
    }
    /* Three spellings for one thing — the member showing a focus ring. Some
       controls take the focus on their own root (a button); others wrap a real
       input and draw the ring on their frame while the keyboard is held
       somewhere inside (a picker, a spin). The ring is what must not be sliced,
       so the member holding it is raised whether it wears the state itself or
       merely contains it. */
    > *:focus-visible,
    > *[data-focus-visible],
    > *:has([data-focus-visible]) {
      position: relative;
      z-index: var(--navi-z-index-control-focused);
    }

    /* Horizontal (default): Cumulative margin for border overlap */
    &:not([data-vertical]) {
      > *:not(:first-child) {
        margin-left: calc(var(--border-width, var(--group-border-width)) * -1);
      }
      > *:first-child:not(:only-child) {
        --x-corner-top-right-radius: 0;
        --x-corner-bottom-right-radius: 0;

        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }

      > *:last-child:not(:only-child) {
        --x-corner-top-left-radius: 0;
        --x-corner-bottom-left-radius: 0;

        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
      }

      > *:not(:first-child):not(:last-child) {
        --x-corner-top-left-radius: 0;
        --x-corner-top-right-radius: 0;
        --x-corner-bottom-right-radius: 0;
        --x-corner-bottom-left-radius: 0;

        border-radius: 0 !important;
      }
    }

    /* Vertical: Cumulative margin for border overlap */
    &[data-vertical] {
      > *:not(:first-child) {
        margin-top: calc(var(--border-width, var(--group-border-width)) * -1);
      }
      > *:first-child:not(:only-child) {
        --x-corner-bottom-right-radius: 0;
        --x-corner-bottom-left-radius: 0;

        border-bottom-right-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
      }

      > *:last-child:not(:only-child) {
        --x-corner-top-left-radius: 0;
        --x-corner-top-right-radius: 0;

        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;
      }

      > *:not(:first-child):not(:last-child) {
        --x-corner-top-left-radius: 0;
        --x-corner-top-right-radius: 0;
        --x-corner-bottom-right-radius: 0;
        --x-corner-bottom-left-radius: 0;

        border-radius: 0 !important;
      }
    }
  }
`;

export const Group = ({ children, row, vertical = row, ...props }) => {
  import.meta.css = css;

  return (
    <Box
      baseClassName="navi_group"
      data-vertical={vertical ? "" : undefined}
      /* A group draws one frame around its members, so they must share their
         top and bottom edges. A block box lays them out inline, where they
         align on baselines instead: a member whose content carries no text —
         the swatch of a color picker — has no baseline of its own, the one
         synthesized from its bottom edge does not land where its neighbours'
         text does, and the member rides a few pixels off, slicing the frame.
         Flex aligns the edges, in both directions. */
      flex={vertical ? "y" : "x"}
      {...props}
    >
      {children}
    </Box>
  );
};
