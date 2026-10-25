/**
 * The mark at the top-right corner of a control or an icon saying "something
 * waits for you here": `badge` on Icon, Button, Link and ControlSwap.Side all
 * draw it, so the corner, the size, the ring and what a screen reader hears are
 * decided once.
 *
 * The host is whatever box the mark is placed against — an icon's own box, a
 * button's frame, a link — and must be positioned; each host says so in its own
 * css. The mark sits across the corner rather than inside it, so it reads as on
 * top of the thing rather than part of its drawing.
 *
 * The ring is drawn in the paper's colour: it is what separates the mark from
 * what it overlaps (a bell's outline, a button's border), not a colour of its
 * own.
 */

const css = /* css */ `
  .navi_badge_mark {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    display: flex;
    border-radius: 100em;
    box-shadow: 0 0 0 var(--navi-badge-mark-ring-width, max(1px, 0.1em))
      var(--navi-badge-mark-ring-color, var(--navi-surface-color));
    transform: translate(30%, -30%);
    /* The host is the press: a mark drawn over its corner must not take the
       press away from it, nor be what a pointer is said to be over. */
    pointer-events: none;

    &[data-dot] {
      aspect-ratio: 1;
      width: var(--navi-badge-mark-size, 0.45em);
      background-color: var(--navi-badge-mark-color, var(--navi-accent-color));
    }
    /* On an icon the box is the glyph, whatever font the text around it has:
       a share of it, so a 24px block icon and a 1em character icon carry the
       same mark. */
    &[data-dot][data-on="icon"] {
      width: var(--navi-badge-mark-size, 40%);
    }
  }

  .navi_badge_mark_label {
    position: absolute;
    width: 1px;
    height: 1px;
    white-space: nowrap;
    clip-path: inset(50%);
    overflow: hidden;
  }
`;

/**
 * @param {boolean|import("preact").ComponentChildren} badge - `true` draws a
 *   dot; anything else is drawn as given.
 * @param {"icon"} [on] - The host is an icon's box: the dot is a share of it.
 */
export const BadgeMark = ({ badge, on }) => {
  // Before the sheet: a host renders this on every render, and a page without
  // a single mark has no use for it.
  if (!badge) {
    return null;
  }
  import.meta.css = css;
  const isDot = badge === true;
  return (
    <span
      className="navi_badge_mark"
      data-dot={isDot ? "" : undefined}
      data-on={on}
      aria-hidden="true"
    >
      {isDot ? null : badge}
    </span>
  );
};

export const BadgeMarkLabel = ({ children }) => {
  import.meta.css = css;
  // The leading space: it is read right after the host's own text.
  return <span className="navi_badge_mark_label"> {children}</span>;
};

// How a host says what its mark means. A name given by `aria-label` replaces
// the name read from the content, so a label drawn as hidden text inside the
// host would never be heard: it is joined to that name instead.
export const resolveBadgeLabel = ({ badge, badgeLabel, ariaLabel }) => {
  if (!badge || !badgeLabel) {
    return { ariaLabel: undefined, labelElement: null };
  }
  if (ariaLabel) {
    return { ariaLabel: `${ariaLabel}, ${badgeLabel}`, labelElement: null };
  }
  return {
    ariaLabel: undefined,
    labelElement: <BadgeMarkLabel>{badgeLabel}</BadgeMarkLabel>,
  };
};
