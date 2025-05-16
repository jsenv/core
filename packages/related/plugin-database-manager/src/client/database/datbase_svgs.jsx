// https://www.svgrepo.com/svg/437830/database
export const DatabaseSvg = ({ color = "currentColor" }) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse
        cx="12"
        cy="6"
        rx="8"
        ry="2"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M20 12C20 13.1046 16.4183 14 12 14C7.58172 14 4 13.1046 4 12"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M4 6V18C4 19.1046 7.58172 20 12 20C16.4183 20 20 19.1046 20 18V6"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

// https://www.svgrepo.com/svg/437987/plus-circle
export const DatabaseWithPlusSvg = ({ color }) => {
  return (
    <svg>
      <DatabaseSvg color={color} />
      <PlusSvg color={color} />
    </svg>
  );
};

const PlusSvg = ({ color = "currentColor" }) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 7.75732L12 16.2426"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M7.75735 12L16.2426 12"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
      />
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="9"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
