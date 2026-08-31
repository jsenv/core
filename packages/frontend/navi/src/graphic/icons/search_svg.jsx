// The box is centered, the drawing is not: the ring carries nearly all the ink
// and sits in the top-left corner, the tail is thin and runs down-right, so the
// mass lands around 11.3 of a 24 box instead of 12. Centered on its bounding
// box the glyph reads high and left in a square; the origin moves instead, by
// the 0.7 units that separate the two.
export const SearchSvg = () => (
  <svg viewBox="-0.7 -0.7 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
      fill="currentColor"
    />
  </svg>
);

export const SearchSvg2 = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
    <path
      fill="currentColor"
      d="M181.657,170.343l-44.284-44.284a68.116,68.116,0,1,0-11.314,11.314l44.284,44.284ZM84,136a52,52,0,1,1,52-52A52.059,52.059,0,0,1,84,136Z"
    />
  </svg>
);
