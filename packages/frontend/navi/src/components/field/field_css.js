import.meta.css = /* css */ `
  :root {
    --navi-field-border-width: 1px;
    --navi-field-outline-width: 1px;
    --navi-field-border-radius: 2px;

    --navi-field-strong-color: light-dark(#355fcc, #3b82f6);
    --navi-field-outline-color: var(--navi-field-strong-color);
    --navi-field-background-color: light-dark(#f3f4f6, #2d3748);
    --navi-field-border-color: light-dark(#767676, #8e8e93);

    --navi-field-disabled-border-color: color-mix(
      in srgb,
      var(--navi-field-border-color) 30%,
      white
    );
    --navi-field-readonly-border-color: var(--navi-field-disabled-border-color);
    --navi-field-active-border-color: color-mix(
      in srgb,
      var(--navi-field-border-color) 90%,
      black
    );
    --navi-field-hover-border-color: color-mix(
      in srgb,
      var(--navi-field-border-color) 70%,
      black
    );

    --navi-field-disabled-background-color: var(--navi-field-background-color);
    --navi-field-readonly-background-color: var(
      --navi-field-disabled-background-color
    );
    --navi-field-hover-background-color: color-mix(
      in srgb,
      var(--navi-field-background-color) 95%,
      black
    );

    --navi-field-disabled-text-color: color-mix(
      in srgb,
      currentColor 30%,
      transparent
    );
    --navi-field-readonly-text-color: var(--navi-field-disabled-text-color);
  }

  [data-field] {
    border-radius: var(--navi-field-border-radius);
    outline-width: var(--navi-field-border-width);
    outline-style: solid;
    outline-color: transparent;
    outline-offset: calc(-1 * (var(--navifield-border-width)));
  }

  [data-field][data-field-with-border] {
    border-width: calc(
      var(--navi-field-border-width) + var(--navi-field-outline-width)
    );
    border-style: solid;
    border-color: transparent;
    outline-color: var(--navi-field-border-color);
  }

  [data-field-with-border-hover] {
    border: 0;
  }

  [data-field-with-background] {
    background-color: var(--navi-field-background-color);
  }
  [data-field-with-background-hover] {
    background: none;
  }

  [data-field-with-background]:hover {
    background-color: var(--navi-field-hover-background-color);
  }

  [data-field-with-hover]:hover {
    outline-color: var(--navi-field-hover-border-color);
  }

  [data-field-with-border]:active,
  [data-field][data-field-with-border][data-active] {
    outline-color: var(--navi-field-active-border-color);
    background-color: none;
  }

  [data-field-with-border][readonly],
  [data-field-with-border][data-readonly] {
    outline-color: var(--navi-field-readonly-border-color);
  }

  [data-field][readonly],
  [data-field][data-readonly] {
    color: var(--navi-field-readonly-text-color);
  }

  [data-field-with-background][readonly],
  [data-field-with-background][data-readonly] {
    background-color: var(--navi-field-readonly-background-color);
  }

  [data-field]:focus-visible,
  [data-field][data-focus-visible]:focus {
    outline-style: solid;
    outline-width: calc(
      var(--navi-field-border-width) + var(--navi-field-outline-width)
    );
    outline-offset: calc(
      -1 * (var(--navi-field-border-width) + var(--navi-field-outline-width))
    );
    outline-color: var(--navi-field-outline-color);
  }

  [data-field]:disabled,
  [data-field][data-disabled],
  [data-field-with-hover]:disabled:hover,
  [data-field-with-hover][data-disabled]:hover {
    outline-color: var(--navi-field-disabled-border-color);
    color: var(--navi-field-disabled-text-color);
  }
  [data-field-with-background]:disabled,
  [data-field-with-background][disabled] {
    background-color: var(--navi-field-disabled-background-color);
  }
`;
