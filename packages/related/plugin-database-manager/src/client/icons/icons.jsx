export const CurrentSvg = () => {
  return (
    <svg
      viewBox="0 0 16 16"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m 8 0 c -3.3125 0 -6 2.6875 -6 6 c 0.007812 0.710938 0.136719 1.414062 0.386719 2.078125 l -0.015625 -0.003906 c 0.636718 1.988281 3.78125 5.082031 5.625 6.929687 h 0.003906 v -0.003906 c 1.507812 -1.507812 3.878906 -3.925781 5.046875 -5.753906 c 0.261719 -0.414063 0.46875 -0.808594 0.585937 -1.171875 l -0.019531 0.003906 c 0.25 -0.664063 0.382813 -1.367187 0.386719 -2.078125 c 0 -3.3125 -2.683594 -6 -6 -6 z m 0 3.691406 c 1.273438 0 2.308594 1.035156 2.308594 2.308594 s -1.035156 2.308594 -2.308594 2.308594 c -1.273438 -0.003906 -2.304688 -1.035156 -2.304688 -2.308594 c -0.003906 -1.273438 1.03125 -2.304688 2.304688 -2.308594 z m 0 0"
        fill="#2e3436"
      />
    </svg>
  );
};

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
