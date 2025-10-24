import.meta.css = /* css */ `
  :root {
    --navi-field-border-width: 1px;
    --navi-field-outline-width: 1px;

    --navi-field-border-color: light-dark(#767676, #8e8e93);
    --navi-field-background-color: light-dark(#f3f4f6, #2d3748);
    --navi-field-accent-color: light-dark(#355fcc, #3b82f6);
    --navi-field-outline-color: var(--navi-field-accent-color);
    --navi-field-foreground-light-color: white;
    --navi-field-foreground-dark-color: #3b82f6;

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

    --navi-field-disabled-color: color-mix(
      in srgb,
      currentColor 30%,
      transparent
    );
    --navi-field-readonly-color: var(--navi-field-disabled-color);
  }

  [data-field] {
    outline-width: var(--navi-field-border-width);
    outline-style: solid;
    outline-color: transparent;
    outline-offset: calc(-1 * (var(--navifield-border-width)));
  }
  [data-field-wrapper][data-readonly] [data-field] {
    color: var(--navi-field-readonly-color);
  }
  [data-field-wrapper][data-focus-visible] [data-field] {
    outline-style: solid;
    outline-width: calc(
      var(--navi-field-border-width) + var(--navi-field-outline-width)
    );
    outline-offset: calc(
      -1 * (var(--navi-field-border-width) + var(--navi-field-outline-width))
    );
    outline-color: var(--navi-field-outline-color);
  }
  [data-field-wrapper][data-disabled] [data-field] {
    background-color: var(--navi-field-disabled-background-color);
    outline-color: var(--navi-field-disabled-border-color);
    color: var(--navi-field-disabled-color);
  }

  [data-field-with-border] {
    border-width: calc(
      var(--navi-field-border-width) + var(--navi-field-outline-width)
    );
    border-style: solid;
    border-color: transparent;
    outline-color: var(--navi-field-border-color);
  }
  [data-field-with-border-hover-only] {
    border: 0;
  }
  [data-field-wrapper][data-hover] [data-field-with-hover-effect-on-border] {
    outline-color: var(--navi-field-hover-border-color);
  }
  [data-field-wrapper][data-readonly] [data-field-with-border] {
    outline-color: var(--navi-field-readonly-border-color);
  }
  [data-field-wrapper][data-active] [data-field-with-border] {
    outline-color: var(--navi-field-active-border-color);
    background-color: none;
  }

  [data-field-with-background] {
    background-color: var(--navi-field-background-color);
  }
  [data-field-with-background-hover-only] {
    background: none;
  }
  [data-field-wrapper][data-hover] [data-field-with-background] {
    background-color: var(--navi-field-hover-background-color);
  }
  [data-field-wrapper][data-readonly] [data-field-with-background] {
    background-color: var(--navi-field-readonly-background-color);
  }
`;
