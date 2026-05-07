import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";

const css = /* css */ `
  @keyframes navi_image_shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  .navi_image {
    &[navi-placeholder] {
      background-image:
        linear-gradient(
          105deg,
          transparent 30%,
          color-mix(in srgb, var(--placeholder-color) 0%, white 18%) 50%,
          transparent 70%
        ),
        radial-gradient(
          ellipse at 40% 40%,
          color-mix(in srgb, var(--placeholder-color) 60%, white 40%) 0%,
          var(--placeholder-color) 70%
        );
      background-size:
        200% 100%,
        100% 100%;
      animation: navi_image_shimmer 2s linear infinite;
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
