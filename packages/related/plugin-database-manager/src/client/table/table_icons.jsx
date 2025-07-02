// https://www.svgrepo.com/collection/zest-interface-icons/12
// https://flowbite.com/icons/

import { SvgWithPlus } from "../svg/svg_composition.jsx";

export const TableSvg = ({ color = "currentColor" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Table outer border */}
      <rect x="3" y="4" width="18" height="16" rx="1" />

      {/* Horizontal grid line */}
      <line x1="3" y1="10" x2="21" y2="10" />

      {/* Vertical grid lines */}
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
};

export const TableWithPlusSvg = ({ color }) => {
  return (
    <SvgWithPlus>
      <TableSvg color={color} />
    </SvgWithPlus>
  );
};
