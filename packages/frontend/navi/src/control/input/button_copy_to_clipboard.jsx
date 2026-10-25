import { Box } from "../../box/box.jsx";
import { buttonI18n } from "../../text/navi_i18n.js";
import { Icon } from "../../text/text.jsx";
import { Button } from "./button.jsx";
import { useCopyToClipboard } from "./use_copy_to_clipboard.js";

const css = /* css */ `
  @layer navi {
    .navi_clipboard_container {
      --height: 1.5em;
      --notif-spacing: 0.5em;
    }
  }

  .navi_clipboard_container {
    position: relative;
    display: inline-flex;
    height: var(--height);
    align-items: center;

    .navi_copied_notif {
      position: absolute;
      top: calc(-1 * var(--notif-spacing));
      right: 0;
      padding: 0.2em 0.5em;
      color: white;
      font-size: 80%;
      white-space: nowrap;
      background: black;
      border-radius: 3px;
      transform: translateY(-100%);
    }
  }
`;

/**
 * A square icon button copying its `children` (a text), with a bubble saying
 * it did. Its mechanics are `useCopyToClipboard`, for a copy drawn any other
 * way.
 *
 * A copy writes nothing: in a form the network policy holds, it still copies.
 *
 * @type {import("preact").FunctionComponent<{
 *   children: string,
 *   "aria-label"?: string,
 *   selfInteractions?: string,
 *   whenSelfInteractionsBlocked?: "hide" | "refuse" | "ignore",
 *   [key: string]: any,
 * }>}
 * @param {"hide"|"refuse"|"ignore"} [whenSelfInteractionsBlocked] Said of the
 *   button, as on any Button: `"ignore"` keeps the copy pressable in a zone
 *   read-only, disabled or busy for its own reasons.
 */
export const ButtonCopyToClipboard = ({
  children,
  "aria-label": ariaLabel = buttonI18n("button.copy"),
  selfInteractions,
  whenSelfInteractionsBlocked,
  ...props
}) => {
  import.meta.css = css;
  const [copied, copy] = useCopyToClipboard(children);

  return (
    <Box className="navi_clipboard_container" {...props}>
      {/* A status: what it says when the copy lands is announced, which is
          the only confirmation someone who cannot see the bubble gets. */}
      <Box className="navi_copied_notif" role="status" opacity={copied ? 1 : 0}>
        {copied ? buttonI18n("button.copied") : null}
      </Box>
      <Button
        className="navi_copy_button"
        // The props land on the container; the name belongs to the button,
        // which shows only an icon, and so does what it says of the zone it
        // sits in.
        aria-label={ariaLabel}
        selfInteractions={selfInteractions}
        whenSelfInteractionsBlocked={whenSelfInteractionsBlocked}
        icon
        revealOnInteraction
        square
        expandY
        borderRadius="xs"
        action={copy}
      >
        {copied ? (
          <Icon color="green">
            <CopiedIcon />
          </Icon>
        ) : (
          <Icon>
            <CopyIcon />
          </Icon>
        )}
      </Button>
    </Box>
  );
};

const CopyIcon = () => (
  <svg viewBox="0 0 16 16">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
  </svg>
);
const CopiedIcon = () => (
  <svg viewBox="0 0 16 16">
    <path
      fill="currentColor"
      d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
    ></path>
  </svg>
);
