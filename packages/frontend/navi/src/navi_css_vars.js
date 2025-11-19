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
    }
  }
`;
