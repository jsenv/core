// Drawn 0.7 off the corner rather than centered on its bounding box: the ring
// carries nearly all the ink and sits up in the top-left, the tail is thin and
// runs down-right, so the mass lands around 11.3 of the 24 box while the box
// says 12. Centered on the box the glyph reads high and left in a square — the
// 0.7 between the two is baked into the coordinates below.
export const SearchSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16.2 14.7h-.79l-.28-.27C16.11 13.29 16.7 11.81 16.7 10.2 16.7 6.61 13.79 3.7 10.2 3.7S3.7 6.61 3.7 10.2 6.61 16.7 10.2 16.7c1.61 0 3.09-.59 4.23-1.57l.27 .28v.79l5 4.99L21.19 19.7l-4.99-5zm-6 0C7.71 14.7 5.7 12.69 5.7 10.2S7.71 5.7 10.2 5.7 14.7 7.71 14.7 10.2 12.69 14.7 10.2 14.7z"
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
