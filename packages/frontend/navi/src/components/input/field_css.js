import.meta.css = /* css */ `
  [data-field] {
    --field-border-width: 1px;
    --field-outline-width: 1px;

    --field-border-color: light-dark(#767676, #8e8e93);
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
    --field-readonly-hover-border-color: color-mix(
      in srgb,
      var(--field-border-color) 70%,
      white
    );

    --field-outline-color: light-dark(#355fcc, #3b82f6);

    --field-background-color: light-dark(#f3f4f6, #2d3748);
    --field-hover-background-color: color-mix(
      in srgb,
      var(--field-background-color) 95%,
      black
    );
    --field-readonly-background-color: color-mix(
      in srgb,
      var(--field-background-color) 95%,
      white
    );
  }

  [data-field] {
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
    outline-style: dashed;
    outline-color: light-dark(#d1d5db, #4b5563);
    background: var(--field-readonly-background-color);
    color: light-dark(#374151, #cbd5e0);
  }
  [data-field-with-hover][data-readonly]:hover {
    outline-color: var(--field-readonly-hover-border-color);
    background: light-dark(#f1f5f9, #334155);
    color: light-dark(#374151, #cbd5e0);
  }

  [data-field]:focus-visible {
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
    outline-color: light-dark(#a0a0a050, #90909050);
    background-color: rgb(239, 239, 239);
    color: light-dark(rgba(16, 16, 16, 0.3), rgba(255, 255, 255, 0.3));
  }
`;
