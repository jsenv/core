import { useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";

const css = /* css */ `
  .navi_image {
    &[navi-placeholder] {
      background-color: var(--placholder-color, transparent);
    }
  }
}`;

/**
 * @param {string|false} [props.placeholderColor] - Background color shown while the image loads.
 *   Defaults to a light gray. Pass `false` to disable.
 */
export const Image = ({ placeholderColor = "#e2e8f0", ...rest }) => {
  import.meta.css = css;
  const loadedRef = useRef();

  return (
    <Box
      {...rest}
      as="img"
      baseClassName="navi_image"
      navi-placeholder={loadedRef.current ? undefined : ""}
      style={{
        "--placeholder-color": placeholderColor,
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
