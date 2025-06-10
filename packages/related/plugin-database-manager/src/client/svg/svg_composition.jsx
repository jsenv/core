import { PlusSvg } from "./icons.jsx";
import { SVGMaskOverlay } from "./svg_mask_overlay.jsx";

export const SvgIconGroup = ({ children }) => {
  return (
    <SVGMaskOverlay viewBox="0 0 24 24" width="100%" height="100%">
      <svg>
        <svg x="0" y="0" width="16" height="16" overflow="visible">
          {children}
        </svg>
        <svg x="8" y="0" width="16" height="16" overflow="visible">
          {children}
        </svg>
      </svg>
      <svg x="4" y="8" width="16" height="18" overflow="visible">
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
