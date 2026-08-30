/**
 * The icon a callout shows beside its message — a square in the status color
 * with the "!" glyph — drawable on its own, where the callout is not: on the
 * trigger that opens one (a picker in callout mode), so what one presses looks
 * like what it opens. The callout's own template draws from the same glyph
 * (see calloutTemplate in callout.js).
 */

const css = /* css */ `
  .navi_callout_status_icon {
    --x-callout-status-icon-color: var(--navi-callout-neutral-color);

    display: inline-flex;
    box-sizing: border-box;
    aspect-ratio: 1 / 1;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    color: white;
    vertical-align: middle;
    background-color: var(--x-callout-status-icon-color);
    border-radius: 2px;

    &[data-status="success"] {
      --x-callout-status-icon-color: var(--navi-callout-success-color);
    }
    &[data-status="info"] {
      --x-callout-status-icon-color: var(--navi-callout-info-color);
    }
    &[data-status="warning"] {
      --x-callout-status-icon-color: var(--navi-callout-warning-color);
    }
    &[data-status="error"] {
      --x-callout-status-icon-color: var(--navi-callout-error-color);
    }
    &[data-shape="circle"] {
      border-radius: 50%;
    }

    /* The svg takes the whole square and the glyph keeps its share of it
       inside the viewBox (see CALLOUT_STATUS_GLYPH_VIEWBOX). Sized as a
       fraction of the square instead, the svg box lands on a fractional
       device pixel and the rasteriser snaps the glyph a pixel off centre —
       visible on a small badge, where the glyph is only a few pixels wide. */
    svg {
      width: 100%;
      height: 100%;
    }
  }
  /* Inside an <Icon>, the icon box is the size: fill it. */
  .navi_icon > .navi_callout_status_icon {
    width: 100%;
    height: 100%;
  }
`;

/**
 * The "!" on a square, viewBox and path both. The box is square and holds the
 * glyph's margin: the ink is 298 of 540 units tall (55%), centered. Drawn this
 * way rather than tight around the ink so whoever shows it can give the svg the
 * whole square — the glyph is then placed by the vector rasteriser, which has
 * no device pixel grid to miss, at any square size down to a fractional one.
 */
export const CALLOUT_STATUS_GLYPH_VIEWBOX = "0 0 540 540";
export const CALLOUT_STATUS_GLYPH_PATH =
  "m232.5,121 8,196h59l8-196zm36.5,224a37,37 0 1,0 2,0z";

/**
 * @type {import("preact").FunctionComponent<{
 *   status?: "info" | "warning" | "error" | "success" | "none",
 *   shape?: "square" | "circle",
 * }>}
 * @param {"info"|"warning"|"error"|"success"|"none"} [status="info"] The color
 *   — the callout's own for that status. `"none"` is the neutral one.
 * @param {"square"|"circle"} [shape="square"] Square like the callout's own
 *   icon, or a circle.
 */
export const CalloutStatusIcon = ({ status = "info", shape = "square" }) => {
  import.meta.css = css;

  return (
    <span
      className="navi_callout_status_icon"
      data-status={status === "none" ? undefined : status}
      data-shape={shape === "circle" ? "circle" : undefined}
      aria-hidden="true"
    >
      <svg
        viewBox={CALLOUT_STATUS_GLYPH_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path fill="currentColor" d={CALLOUT_STATUS_GLYPH_PATH} />
      </svg>
    </span>
  );
};
