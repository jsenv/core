import { useKeyboardShortcuts } from "../use_keyboard_shortcuts.js";

import.meta.css = /* css */ `
  .navi_link {
  }
`;

export const Link = ({
  children,
  shortcuts = [],
  onKeyDown,
  className = "",
  ...rest
}) => {
  const onKeyDownForShortcuts = useKeyboardShortcuts(shortcuts);

  return (
    <a
      {...rest}
      className={["navi_link", ...className.split(" ")].join(" ")}
      onKeyDown={(e) => {
        onKeyDownForShortcuts(e);
        onKeyDown?.(e);
      }}
    >
      {children}
    </a>
  );
};
