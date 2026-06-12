import { Box } from "@jsenv/navi/src/box/box.jsx";

const css = /* css */ `
  @layer navi {
    .navi_checkbox {
      --switch-margin: 2px; /* Useful to reserve space for outline */
      --switch-width: 2em;
      --switch-thumb-size: 1.2em;
      /* Padding uses px and not em otherwise it can be resolved to a float which does not play well */
      /* With the translation calc in some configurations. In the end 2px is nice in all sizes and can still be configured for exceptions */
      --switch-padding: 2px;
      --switch-border-radius: calc(
        var(--switch-thumb-size) / 2 + calc(var(--switch-padding) * 2)
      );
      --switch-thumb-border-radius: 50%;
      --switch-background-color: light-dark(#767676, #8e8e93);
      --switch-background-color-checked: var(--accent-color);
      --switch-background-color-hover: color-mix(
        in srgb,
        var(--switch-background-color) 60%,
        white
      );
      --switch-background-color-readonly: color-mix(
        in srgb,
        var(--switch-background-color) 40%,
        transparent
      );
      --switch-background-color-disabled: color-mix(
        in srgb,
        var(--switch-background-color) 15%,
        #d3d3d3
      );
      --switch-background-color-hover-checked: color-mix(
        in srgb,
        var(--switch-background-color-checked) 90%,
        black
      );
      --switch-background-color-readonly-checked: color-mix(
        in srgb,
        var(--switch-background-color-checked) 40%,
        transparent
      );
      --switch-background-color-disabled-checked: color-mix(
        in srgb,
        var(--switch-background-color-checked) 15%,
        #d3d3d3
      );
      --switch-thumb-color: white;

      &[data-accent-very-light] {
        --switch-thumb-color: rgb(55, 55, 55);
      }
    }

    .navi_checkbox {
      .navi_switch {
        width: var(--switch-thumb-size);
        height: var(--switch-thumb-size);
        border-radius: var(--switch-thumb-border-radius);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        fill: var(--switch-thumb-color);
        transform: translateX(0);
        transition: transform 0.2s ease;
        user-select: none;
      }

      &[data-checked] {
        .navi_switch {
          transform: translateX(
            calc(
              var(--switch-width) - var(--switch-thumb-size) +
                var(--switch-padding)
            )
          );
        }
      }
    }
  }
`;

export const SwitchUI = () => {
  import.meta.css = css;

  return (
    <Box
      className="navi_switch"
      as="svg"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="5"></circle>
    </Box>
  );
};

export const SwitchCSSVars = {
  width: "--switch-width",
  height: "--switch-height",
  borderRadius: "--border-radius",
  padding: "--switch-padding",
};
