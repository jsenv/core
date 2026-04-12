// https://www.svgrepo.com/svg/437987/plus-circle
export const PlusSvg = ({
  circle,
  backgroundColor = "",
  color = "currentColor",
}) => {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {backgroundColor && (
        <rect x="0" y="0" width="24" height="24" fill={backgroundColor}></rect>
      )}
      {circle && (
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
      )}
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
    </svg>
  );
};
