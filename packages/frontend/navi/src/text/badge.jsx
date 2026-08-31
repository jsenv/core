import { useContext, useRef } from "preact/hooks";

import { useControlProps } from "../control/control_hooks.jsx";
import { useSelfInteractionsHidden } from "../control/self_interactions.js";
import { useAccentColorAttributes } from "../utils/use_accent_color_attributes.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { BadgeListContext } from "./badge_list_context.js";
import { Text } from "./text.jsx";

const css = /* css */ `
  @layer navi {
  }
  .navi_badge {
    --font-size: 0.7em;
    --badge-padding-x-default: 0.8em;
    --badge-padding-y-default: 0.4em;

    /* Each side resolves the most specific value it was given, from the side
       itself down to the axis, the shorthand, then the default. Resolved once
       here because the close button below reuses these to cancel the badge
       padding on the edge it sits on. */
    --x-badge-padding-top: var(
      --badge-padding-top,
      var(
        --badge-padding-y,
        var(--badge-padding, var(--badge-padding-y-default))
      )
    );
    --x-badge-padding-right: var(
      --badge-padding-right,
      var(
        --badge-padding-x,
        var(--badge-padding, var(--badge-padding-x-default))
      )
    );
    --x-badge-padding-bottom: var(
      --badge-padding-bottom,
      var(
        --badge-padding-y,
        var(--badge-padding, var(--badge-padding-y-default))
      )
    );
    --x-badge-padding-left: var(
      --badge-padding-left,
      var(
        --badge-padding-x,
        var(--badge-padding, var(--badge-padding-x-default))
      )
    );

    --x-background: var(--background, light-dark(#e0e0e0, #3a3a3a));
    --x-background-color: var(--background-color, var(--x-background));
    /* Default: white text — works on colored backgrounds.
       Overridden to dark when the bg is light enough (data-accent-needs-dark-fg)
       or when no background prop is passed (data-badge-default-bg). */
    --x-color: var(--color, white);

    position: relative;
    display: inline;
    max-width: 200px;
    padding-top: var(--x-badge-padding-top);
    padding-right: var(--x-badge-padding-right);
    padding-bottom: var(--x-badge-padding-bottom);
    padding-left: var(--x-badge-padding-left);
    align-items: stretch;
    color: var(--x-color);
    font-size: var(--font-size);
    /* Cuts the font's half-leading above the first line and below the last one,
       down to cap-height/baseline: the padding becomes the only vertical space
       and the text is exactly centered. Space between wrapped lines is left
       untouched, unlike a line-height tweak. */
    text-box: trim-both cap alphabetic;
    background: var(--x-background);
    background-color: var(--x-background-color);
    border-radius: 1em;

    /* Light colored background needs dark text */
    &[data-accent-needs-dark-fg] {
      --x-color: var(--color, #333);
    }

    &[data-text-overflow] {
      display: inline;

      .navi_text_overflow_wrapper {
        /* Keep badge text and button together */
        gap: 0;
      }
    }

    [role="button"] {
      display: inline-flex;
      margin-top: calc(-1 * var(--x-badge-padding-top));
      margin-bottom: calc(-1 * var(--x-badge-padding-bottom));
      padding-top: var(--x-badge-padding-top);
      padding-right: calc(var(--x-badge-padding-right) / 2);
      padding-bottom: var(--x-badge-padding-bottom);
      padding-left: calc(var(--x-badge-padding-left) / 2);
      align-items: center;
      cursor: pointer;
      pointer-events: auto;
      user-select: none;

      &:first-child {
        margin-left: calc(-1 * var(--x-badge-padding-left));
        border-top-left-radius: inherit;
        border-bottom-left-radius: inherit;
      }

      &:last-child {
        margin-right: calc(-1 * var(--x-badge-padding-right));
        border-top-right-radius: inherit;
        border-bottom-right-radius: inherit;
      }

      &:hover {
        background: rgba(0, 0, 0, 0.15);
      }
    }
  }
`;

export const Badge = (props) => {
  const badgeList = useContext(BadgeListContext);
  const entryStateRef = useRef();
  if (badgeList) {
    // Inside a BadgeList the badge renders nothing: it hands itself over and
    // the list renders it, which is how the list gets to see them all before
    // deciding how many it shows. See badge_list_context.js.
    const entryState = entryStateRef.current || (entryStateRef.current = {});
    badgeList.register(entryState, props);
    return null;
  }
  return <BadgeUI {...props} />;
};

export const BadgeUI = ({ children, className, ...props }) => {
  import.meta.css = css;
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const { ref } = props;
  useAccentColorAttributes(ref, null);

  return (
    <Text
      className={withPropsClassName("navi_badge", className)}
      bold
      maxLines={1}
      // The text-box trim ends the content box at the baseline, and a clamped
      // badge is clipped there: descenders of the last visible line would be
      // cut. Halfway to the next line's cap top keeps them, still above any
      // ink from the line the clamp hides.
      overflowClipMargin="content-box calc((1lh - 1cap) / 2)"
      {...props}
      styleCSSVars={BadgeStyleCSSVars}
      spacing={<span></span>}
    >
      {children}
    </Text>
  );
};
const BadgeStyleCSSVars = {
  borderWidth: "--border-width",
  borderRadius: "--border-radius",
  padding: "--badge-padding",
  paddingX: "--badge-padding-x",
  paddingY: "--badge-padding-y",
  paddingTop: "--badge-padding-top",
  paddingRight: "--badge-padding-right",
  paddingBottom: "--badge-padding-bottom",
  paddingLeft: "--badge-padding-left",
  backgroundColor: "--background-color",
  background: "--background",
  borderColor: "--border-color",
  color: "--color",
  fontSize: "--font-size",
};

const BadgeButton = (props) => {
  const selfInteractionsHidden = useSelfInteractionsHidden(props);

  if (selfInteractionsHidden) {
    return null;
  }
  return <BadgeButtonUI {...props} />;
};
const BadgeButtonUI = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const [buttonRootProps, buttonHostProps] = useControlProps(props, {
    controlType: "button",
    allowNameless: true,
  });

  return (
    <Text
      className="navi_badge_button"
      role="button"
      onnavi_get_value={(e) => {
        e.detail.respondWith(props.value);
      }}
      {...buttonRootProps}
      {...buttonHostProps}
    />
  );
};
Badge.Button = BadgeButton;
