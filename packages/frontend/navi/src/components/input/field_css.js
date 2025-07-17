import.meta.css = /* css */ `
  [data-field],
  [data-field-wrapper] {
    --field-border-width: 1px;
    --field-outline-width: 1px;

    --field-strong-color: light-dark(#355fcc, #3b82f6);
    --field-outline-color: var(--field-strong-color);
    --field-background-color: light-dark(#f3f4f6, #2d3748);
    --field-border-color: light-dark(#767676, #8e8e93);

    --field-disabled-border-color: color-mix(
      in srgb,
      var(--field-border-color) 30%,
      white
    );
    --field-readonly-border-color: var(--field-disabled-border-color);
    --field-active-border-color: color-mix(
      in srgb,
      var(--field-border-color) 90%,
      black
    );
    --field-hover-border-color: color-mix(
      in srgb,
      var(--field-border-color) 70%,
      black
    );

    --field-disabled-background-color: var(--field-background-color);
    --field-readonly-background-color: var(--field-disabled-background-color);
    --field-hover-background-color: color-mix(
      in srgb,
      var(--field-background-color) 95%,
      black
    );

    --field-disabled-text-color: color-mix(
      in srgb,
      currentColor 30%,
      transparent
    );
    --field-readonly-text-color: var(--field-disabled-text-color);
  }

  [data-field] {
    border-radius: 2px;
    border-width: calc(var(--field-border-width) + var(--field-outline-width));
    border-style: solid;
    border-color: transparent;
    outline: var(--field-border-width) solid var(--field-border-color);
    outline-offset: calc(-1 * (var(--field-border-width)));
  }

  [data-field-with-background] {
    background: var(--field-background-color);
  }

  [data-field-with-hover]:hover {
    outline-color: var(--field-hover-border-color);
    background: var(--field-hover-background-color);
  }

  [data-field]:active,
  [data-field][data-active] {
    outline-color: var(--field-active-border-color);
  }

  [data-field][readonly],
  [data-field][data-readonly] {
    outline-color: var(--field-readonly-border-color);
    background-color: var(--field-readonly-background-color);
    color: var(--field-readonly-text-color);
  }

  [data-field]:focus-visible {
    outline-style: solid;
    outline-width: calc(var(--field-border-width) + var(--field-outline-width));
    outline-offset: calc(
      -1 * (var(--field-border-width) + var(--field-outline-width))
    );
    outline-color: var(--field-outline-color);
  }

  [data-field]:disabled,
  [data-field][data-disabled],
  [data-field-with-hover]:disabled:hover,
  [data-field-with-hover][data-disabled]:hover {
    outline-color: var(--field-disabled-border-color);
    background-color: var(--field-disabled-background-color);
    color: var(--field-disabled-text-color);
  }
`;
