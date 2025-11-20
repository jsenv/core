import { Box } from "./box.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_viewport_layout {
      --padding: 40px;
      --background: white;
    }
  }

  .navi_viewport_layout {
    padding-top: var(--padding-top, var(--padding-y, var(--padding)));
    padding-right: var(--padding-right, var(--padding-x, var(--padding)));
    padding-bottom: var(--padding-bottom, var(--padding-y, var(--padding)));
    padding-left: var(--padding-left, var(--padding-x, var(--padding)));
    background: var(--background);
  }
`;

const ViewportManagedByCSSVars = {
  padding: "--padding",
  paddingTop: "--padding-top",
  paddingBottom: "--padding-bottom",
  paddingLeft: "--padding-left",
  paddingRight: "--padding-right",
  background: "--background",
};
export const ViewportLayout = (props) => {
  return (
    <Box
      row
      {...props}
      className="navi_viewport_layout"
      managedByCSSVars={ViewportManagedByCSSVars}
      minWidth="max-content"
      minHeight="max-content"
      width="100%"
      height="100%"
    />
  );
};
