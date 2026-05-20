import { Box } from "@jsenv/navi/src/box/box.jsx";

const css = /* css */ `
  @layer navi {
    .navi_radio,
    .navi_checkbox {
      --toggle-margin: 2px; /* Useful to reserve space for outline */
      --toggle-width: 2em;
      --toggle-thumb-size: 1.2em;
      /* Padding uses px and not em otherwise it can be resolved to a float which does not play well */
      /* With the translation calc in some configurations. In the end 2px is nice in all sizes and can still be configured for exceptions */
      --toggle-padding: 2px;
      --toggle-border-radius: calc(
        var(--toggle-thumb-size) / 2 + calc(var(--toggle-padding) * 2)
      );
      --toggle-thumb-border-radius: 50%;
      --toggle-background-color: light-dark(#767676, #8e8e93);
      --toggle-background-color-checked: var(--accent-color);
      --toggle-background-color-hover: color-mix(
        in srgb,
        var(--toggle-background-color) 60%,
        white
      );
      --toggle-background-color-readonly: color-mix(
        in srgb,
        var(--toggle-background-color) 40%,
        transparent
      );
      --toggle-background-color-disabled: color-mix(
        in srgb,
        var(--toggle-background-color) 15%,
        #d3d3d3
      );
      --toggle-background-color-hover-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 90%,
        black
      );
      --toggle-background-color-readonly-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 40%,
        transparent
      );
      --toggle-background-color-disabled-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 15%,
        #d3d3d3
      );
      --toggle-thumb-color: white;

      &[data-accent-very-light] {
        --toggle-thumb-color: rgb(55, 55, 55);
      }
    }
  }

  .navi_radio,
  .navi_checkbox {
    .navi_toggle {
      width: var(--toggle-thumb-size);
      height: var(--toggle-thumb-size);
      border-radius: var(--toggle-thumb-border-radius);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      fill: var(--toggle-thumb-color);
      transform: translateX(0);
      transition: transform 0.2s ease;
      user-select: none;
    }

    &[data-checked] {
      .navi_toggle {
        transform: translateX(
          calc(
            var(--toggle-width) - var(--toggle-thumb-size) +
              var(--toggle-padding)
          )
        );
      }
    }
  }
`;

export const ToggleUI = () => {
  import.meta.css = css;

  return (
    <Box
      className="navi_toggle"
      as="svg"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="5"></circle>
    </Box>
  );
};

export const ToggleCSSVars = {
  width: "--toggle-width",
  height: "--toggle-height",
  borderRadius: "--border-radius",
  padding: "--toggle-padding",
};
