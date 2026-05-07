import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";

const css = /* css */ `
  @keyframes navi_image_placeholder_pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  .navi_image {
    &[navi-placeholder] {
      background-color: var(--placeholder-color);
      animation: navi_image_placeholder_pulse 1.5s ease-in-out infinite;
    }
  }
`;

const DEFAULT_PLACEHOLDER_LIGHT = "#c8cdd4";
const DEFAULT_PLACEHOLDER_DARK = "#374151";

/**
 * @param {string|false} [props.placeholderColor] - Background color shown while the image loads.
 *   Defaults to a light gray. Pass `false` to disable.
 * @param {boolean} [props.placeholderDark] - Use a dark default placeholder color,
 *   suited for images displayed on a dark background.
 */
export const Image = ({
  placeholderColor,
  placeholderDark = false,
  ...rest
}) => {
  import.meta.css = css;
  const loadedRef = useRef();

  let resolvedPlaceholder = placeholderColor;
  if (resolvedPlaceholder === undefined) {
    resolvedPlaceholder = placeholderDark
      ? DEFAULT_PLACEHOLDER_DARK
      : DEFAULT_PLACEHOLDER_LIGHT;
  }

  return (
    <Box
      {...rest}
      as="img"
      baseClassName="navi_image"
      navi-placeholder={loadedRef.current ? undefined : ""}
      style={{
        "--placeholder-color": resolvedPlaceholder || undefined,
        ...rest.style,
      }}
      onLoad={(e) => {
        const imageEl = e.currentTarget;
        imageEl.removeAttribute("navi-placeholder");
        imageEl.setAttribute("navi-loaded", "");
        rest.onLoad?.(e);
      }}
    />
  );
};
