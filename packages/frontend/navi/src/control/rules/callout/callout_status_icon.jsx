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

    svg {
      width: auto;
      height: 55%;
    }
  }
  /* Inside an <Icon>, the icon box is the size: fill it. The glyph keeps its
     own share of it — the Icon's rule sizing any svg it holds to the whole
     box is for an svg that IS the icon, and this one sits in a square. */
  .navi_icon > .navi_callout_status_icon {
    width: 100%;
    height: 100%;
  }
  .navi_icon[data-icon-char] .navi_callout_status_icon svg {
    width: auto;
    height: 55%;
  }
`;

export const CALLOUT_STATUS_GLYPH_VIEWBOX = "0 0 125 300";
export const CALLOUT_STATUS_GLYPH_PATH =
  "m25,1 8,196h59l8-196zm37,224a37,37 0 1,0 2,0z";

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
