import { FontSizedSvg } from "../svg/font_sized_svg.jsx";
import { CurrentSvg } from "../svg/icons.jsx";

import.meta.css = /* css */ `
  .link_with_icon {
    white-space: nowrap;
    align-items: center;
    gap: 0.3em;
    min-width: 0;
    display: inline-flex;
    flex-grow: 1;
    overflow: hidden;
  }

  .link_with_icon[data-active] {
    background-color: lightgrey;
  }
`;

export const LinkWithIcon = ({ icon, isCurrent, children, ...rest }) => {
  return (
    <a className="link_with_icon" {...rest}>
      <FontSizedSvg>{icon}</FontSizedSvg>
      {isCurrent && (
        <FontSizedSvg>
          <CurrentSvg />
        </FontSizedSvg>
      )}
      {children}
    </a>
  );
};
