/**
 * Every z-index navi can be seen competing on, in one place, ordered.
 *
 * The point is the overview: reading this file must be enough to know what
 * paints over what, and adding a value here forces the question "against
 * what?" to be answered before a number is written. These are not meant as a
 * theming surface — override one only to get out of a conflict with an app
 * that cannot move.
 *
 * What belongs here: anything whose stacking is decided against an element
 * from ANOTHER component — a bar, a popup, a control raising itself above the
 * neighbour it overlaps. A z-index that only orders a component's own parts
 * (a shadow under its own content, a checkbox mark over its own box) stays a
 * literal next to the rule that needs it: it says "above my sibling", nothing
 * more, and routing it through a token would only dilute the overview.
 *
 * The bands are decades apart so a band can grow without reaching the next
 * one, and so a value read in a devtools panel says which band it came from.
 *
 * Read docs/z_index.md first — DOM order and `isolation: isolate` come before
 * any of these, and a number is the last resort, not the first tool.
 */

const css = /* css */ `
  @layer navi {
    :root {
      /* A control that overlaps its neighbours (the members of a Group share
         one border along each seam) and has to paint in front of them while
         the user is on it: its border color change, then its focus ring, which
         a neighbour painted later would otherwise slice in half. Focus above
         hover, since a focused member can sit next to a hovered one. */
      --navi-z-index-control-hovered: 1;
      --navi-z-index-control-focused: 2;

      /* Kept stuck while something scrolls under it: a list header, the head
         and foot of a side panel, a table's sticky cells. Above raised
         controls — a control scrolling past must go under the header that
         pins the column it belongs to, never over it.

         "While stuck" is the whole condition, and a sticky element cannot read
         its own stuck state in CSS: List marks its parts with a navi-stuck
         attribute and applies this band only there (see --list-*-z-index in
         list.jsx). A
         sticky part at rest is a block in the flow with nothing passing under
         it; giving it this band anyway is what slices whatever a neighbouring
         row lets out of its box. */
      --navi-z-index-sticky: 10;

      /* Pinned to the viewport, over the whole page: FixedBar. A decade of its
         own and well above the sticky band, so that no sticky cell and no
         hovered control can ever be seen crossing it. */
      --navi-z-index-bar: 100;

      /* Popups: Dialog/Popover with layer="local", their backdrop, and the
         validation callouts. Above everything the page can produce, which is
         the whole point of the gap — a popup never has to guess. Each opened
         popup adds its stack order on top, so the last one opened wins.
         Dialog/Popover with layer="top" use the browser top layer instead and
         appear in no scale at all. */
      --navi-z-index-popup: 1000;
      --navi-z-index-callout: var(--navi-z-index-popup);
    }
  }
`;
import.meta.css = css;
