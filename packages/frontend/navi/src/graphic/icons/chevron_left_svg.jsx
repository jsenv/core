// A stroked chevron, unlike the solid ChevronDownSvg used to point at a
// popup: this one reads as "go back", where the platform convention is a thin
// line, not a filled triangle.
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
