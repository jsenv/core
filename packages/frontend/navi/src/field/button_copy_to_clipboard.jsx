import { useEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { Icon } from "../graphic/icon.jsx";
import { Button } from "./button.jsx";

import.meta.css = /* css */ `
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

export const ButtonCopyToClipboard = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const renderedRef = useRef();

  useEffect(() => {
    renderedRef.current = true;
    return () => {
      renderedRef.current = false;
    };
  }, []);

  return (
    <Box class="navi_clipboard_container" {...props}>
      <Box
        className="navi_copied_notif"
        aria-hidden={copied ? "false" : "true"}
        opacity={copied ? 1 : 0}
      >
        Copié !
      </Box>
      <Button
        className="navi_copy_button"
        row
        icon
        revealOnInteraction
        square
        alignY="center"
        expandY
        borderRadius="xs"
        action={async () => {
          await addToClipboard(children);
          setTimeout(() => {
            if (!renderedRef.current) {
              // do not call setState on unmounted component
              return;
            }
            setCopied(false);
          }, 1500);
          setCopied(true);
        }}
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

const addToClipboard = async (text) => {
  const type = "text/plain";
  const clipboardItemData = {
    [type]: text,
  };
  const clipboardItem = new ClipboardItem(clipboardItemData);
  await window.navigator.clipboard.write([clipboardItem]);
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
