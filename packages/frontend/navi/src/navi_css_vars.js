/**
 * Regroup CSS vars that makes sense to share across all navi components.
 */

import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-focus-outline-color: light-dark(#4476ff, #3b82f6);
      --navi-loader-color: light-dark(#355fcc, #3b82f6);
      --navi-selection-border-color: #0078d4;
      --navi-selection-background-color: #eaf1fd;
      --navi-color-light: white;
      --navi-color-dark: rgb(55, 60, 69);

      --navi-info-color-light: #eaf6fc;
      --navi-info-color: #376cc2;
      --navi-success-color-light: #ecf9ef;
      --navi-success-color: #50c464;
      --navi-warning-color-light: #fdf6e3;
      --navi-warning-color: #f19c05;
      --navi-error-color-light: #fcebed;
      --navi-error-color: #eb364b;

      --navi-spacing-xxs: 0.125em;
      --navi-spacing-xs: 0.25em;
      --navi-spacing-s: 0.5em;
      --navi-spacing-m: 1em;
      --navi-spacing-l: 1.5em;
      --navi-spacing-xl: 2em;
      --navi-spacing-xxl: 3em;
    }
  }
`;
