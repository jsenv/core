// Stroked chevrons, unlike the solid ones in chevron_updown_svg.jsx: those
// point AT something (the popup a picker opens), these are directions the user
// can take — go back, dismiss upward — where the platform convention is a thin
// line rather than a filled triangle.
export const ChevronLeftSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15 4.5L7.5 12L15 19.5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

export const ChevronUpSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.5 15L12 7.5L19.5 15"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);
