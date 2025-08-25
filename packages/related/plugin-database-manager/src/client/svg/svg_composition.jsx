import { SVGMaskOverlay } from "@jsenv/navi";
import { PlusSvg } from "./icons.jsx";

export const SvgIconGroup = ({ children }) => {
  return (
    <SVGMaskOverlay viewBox="0 0 24 24" width="100%" height="100%">
      <svg>
        <svg x="2" y="4" width="12" height="12" overflow="visible">
          {children}
        </svg>
        <svg x="10" y="4" width="12" height="12" overflow="visible">
          {children}
        </svg>
      </svg>
      <svg x="6" y="8" width="12" height="12" overflow="visible">
        {children}
      </svg>
    </SVGMaskOverlay>
  );
};

export const SvgWithPlus = ({ children }) => {
  return (
    <SVGMaskOverlay viewBox="0 0 24 24" width="100%" height="100%">
      {children}
      <svg x="12" y="12" width="16" height="16" overflow="visible">
        <circle cx="8" cy="8" r="5" fill="transparent" />
        <PlusSvg color="green" />
      </svg>
    </SVGMaskOverlay>
  );
};
