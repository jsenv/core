/**
 * A card centered in the area it is given: a bordered, rounded, padded surface
 * with room kept all around it. It looks like a dialog and is deliberately not
 * one — it lives in the document, nothing opens or closes it, nothing is made
 * inert behind it. A sign-in screen, an empty state, a one-question page.
 *
 * The room around the card is the outer element's own padding, not a margin on
 * the card: a margin can collapse and can be scrolled past, whereas padding is
 * space the outer box genuinely occupies — so a narrow window shrinks the card
 * and still shows that room, instead of pushing it against the edges.
 */

import { Box } from "../box/box.jsx";

const css = /* css */ `
  @layer navi {
    .navi_card_layout {
      --layout-margin: 30px;
      --layout-padding: 20px;
      --layout-background: var(--navi-surface-color);
      --layout-border-width: 2px;
      --layout-border-color: var(--navi-popup-border-color);
      --layout-border-radius: 10px;
      --layout-min-width: 300px;
      --layout-min-height: auto;
    }
  }
  .navi_card_layout {
    padding-top: var(
      --layout-margin-top,
      var(--layout-margin-y, var(--layout-margin))
    );
    padding-right: var(
      --layout-margin-right,
      var(--layout-margin-x, var(--layout-margin))
    );
    padding-bottom: var(
      --layout-margin-bottom,
      var(--layout-margin-y, var(--layout-margin))
    );
    padding-left: var(
      --layout-margin-left,
      var(--layout-margin-x, var(--layout-margin))
    );
  }

  .navi_card {
    min-width: var(--layout-min-width);
    min-height: var(--layout-min-height);
    padding-top: var(
      --layout-padding-top,
      var(--layout-padding-y, var(--layout-padding))
    );
    padding-right: var(
      --layout-padding-right,
      var(--layout-padding-x, var(--layout-padding))
    );
    padding-bottom: var(
      --layout-padding-bottom,
      var(--layout-padding-y, var(--layout-padding))
    );
    padding-left: var(
      --layout-padding-left,
      var(--layout-padding-x, var(--layout-padding))
    );
    background: var(--layout-background);
    background-color: var(--layout-background-color, var(--layout-background));
    border-width: var(--layout-border-width);
    border-style: solid;
    border-color: var(--layout-border-color);
    border-radius: var(--layout-border-radius);
  }
`;

const CardLayoutStyleCSSVars = {
  margin: "--layout-margin",
  marginTop: "--layout-margin-top",
  marginBottom: "--layout-margin-bottom",
  marginLeft: "--layout-margin-left",
  marginRight: "--layout-margin-right",
  borderRadius: "--layout-border-radius",
  borderWidth: "--layout-border-width",
  borderColor: "--layout-border-color",
  background: "--layout-background",
  backgroundColor: "--layout-background-color",
  padding: "--layout-padding",
  paddingTop: "--layout-padding-top",
  paddingBottom: "--layout-padding-bottom",
  paddingLeft: "--layout-padding-left",
  paddingRight: "--layout-padding-right",
  minWidth: "--layout-min-width",
  minHeight: "--layout-min-height",
};
/**
 * @type {import("preact").FunctionComponent<{
 *   alignX?: string,
 *   alignY?: string,
 *   margin?: string|number,
 *   padding?: string|number,
 *   minWidth?: string|number,
 *   minHeight?: string|number,
 *   background?: string,
 *   borderRadius?: string|number,
 *   borderWidth?: string|number,
 *   borderColor?: string,
 * }>}
 * @param {string} [props.alignX="center"] - Where the card's own content sits
 *   across it. The card itself is always centered in the area.
 * @param {string} [props.alignY="center"] - …and down it.
 * @param {string|number} [props.margin=30] - Room kept between the card and the
 *   edges of the area, on every side (see this file's top comment for why it is
 *   padding underneath). Per-side `marginTop`/`marginRight`/… override it.
 * @param {string|number} [props.padding=20] - Room inside the card, between its
 *   border and its content. Per-side props override it the same way.
 */
export const CardLayout = ({
  children,
  alignX = "center",
  alignY = "center",
  ...props
}) => {
  import.meta.css = css;

  return (
    <Box
      baseClassName="navi_card_layout"
      styleCSSVars={CardLayoutStyleCSSVars}
      visualSelector=".navi_card"
      {...props}
    >
      <Box flex="y" className="navi_card" alignX={alignX} alignY={alignY}>
        {children}
      </Box>
    </Box>
  );
};
