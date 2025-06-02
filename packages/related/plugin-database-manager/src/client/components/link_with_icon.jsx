import { SPALink } from "@jsenv/router";
import { CurrentSvg } from "../icons/icons.jsx";
import { FontSizedSvg } from "./font_sized_svg.jsx";

import.meta.css = /* css */ `
  .link_with_icon {
    white-space: nowrap;
    align-items: center;
    gap: 0.3em;
    min-width: 0;
    display: inline-flex;
    overflow: hidden;
  }
`;

export const LinkWithIcon = ({ icon, isCurrent, children, ...rest }) => {
  return (
    <SPALink className="link_with_icon" {...rest}>
      <FontSizedSvg>{icon}</FontSizedSvg>
      {isCurrent && (
        <FontSizedSvg>
          <CurrentSvg />
        </FontSizedSvg>
      )}
      {children}
    </SPALink>
  );
};
