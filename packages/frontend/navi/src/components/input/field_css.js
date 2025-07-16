import.meta.css = /* css */ `
  [data-field] {
    --field-border-width: 1px;
    --field-outline-width: 1px;
    --field-border-color: light-dark(#767676, #8e8e93);
  }

  [data-field] {
    border-width: calc(var(--field-border-width) + var(--field-outline-width));
    border-style: solid;
    border-color: transparent;
    outline: var(--field-border-width) solid var(--field-border-color);
    outline-offset: calc(-1 * (var(--field-border-width)));
  }

  [data-field-with-hover]:hover {
    outline-color: color-mix(in srgb, var(--field-border-color) 70%, black);
    background: light-dark(#e6e6e6, #2a2a2c);
  }

  [data-field]:active {
    outline-color: color-mix(in srgb, var(--field-border-color) 90%, black);
  }

  [data-field][readonly],
  [data-field][data-readonly] {
    outline-style: dashed;
    outline-color: light-dark(#d1d5db, #4b5563);
    background: light-dark(#f3f4f6, #2d3748);
    color: light-dark(#374151, #cbd5e0);
  }
  [data-field-with-hover][data-readonly]:hover {
    outline-color: light-dark(#c4c4c7, #525252);
    background: light-dark(#f1f5f9, #334155);
    color: light-dark(#374151, #cbd5e0);
  }

  [data-field]:focus-visible {
    outline-width: calc(var(--field-border-width) + var(--field-outline-width));
    outline-offset: calc(
      -1 * (var(--field-border-width) + var(--field-outline-width))
    );
    outline-color: light-dark(#355fcc, #3b82f6);
  }

  [data-field]:disabled,
  [data-field][data-disabled],
  [data-field-with-hover]:disabled:hover {
    outline-color: light-dark(#a0a0a050, #90909050);
    background-color: rgb(239, 239, 239);
    color: light-dark(rgba(16, 16, 16, 0.3), rgba(255, 255, 255, 0.3));
  }
`;
