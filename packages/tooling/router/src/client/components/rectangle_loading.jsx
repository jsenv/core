export const RectangleLoading = ({ color = "#383a36", radius = 0 }) => {
  // Calculate the perimeter of the rectangle
  const pathLength = 2 * (38 + 38) + 2 * Math.PI * radius;

  return (
    <svg
      viewBox="0 0 40 40"
      width="100%"
      height="100%"
      style="overflow: visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Base rectangle outline */}
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        fill="none"
        stroke="rgba(0,0,0,0.05)"
        strokeWidth="1"
        rx={radius}
      />

      {/* Progress segment that grows and moves */}
      <path
        d={`
            M ${1 + radius},1
            L ${39 - radius},1
            A ${radius},${radius} 0 0 1 39,${1 + radius}
            L 39,${39 - radius}
            A ${radius},${radius} 0 0 1 ${39 - radius},39
            L ${1 + radius},39
            A ${radius},${radius} 0 0 1 1,${39 - radius}
            L 1,${1 + radius}
            A ${radius},${radius} 0 0 1 ${1 + radius},1
          `}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
        strokeDasharray={`${pathLength * 0.25} ${pathLength * 0.75}`}
      >
        {/* Clear animation where segment moves around path */}
        <animate
          attributeName="stroke-dashoffset"
          from={pathLength}
          to="0"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </path>

      {/* Leading dot that "pulls" the segment */}
      <circle r="3.5" opacity="0.8" fill={color}>
        <animateMotion
          path={`
              M ${1 + radius},1
              L ${39 - radius},1
              A ${radius},${radius} 0 0 1 39,${1 + radius}
              L 39,${39 - radius}
              A ${radius},${radius} 0 0 1 ${39 - radius},39
              L ${1 + radius},39
              A ${radius},${radius} 0 0 1 1,${39 - radius}
              L 1,${1 + radius}
              A ${radius},${radius} 0 0 1 ${1 + radius},1
            `}
          dur="1.8s"
          repeatCount="indefinite"
          rotate="auto"
          begin="-0.45s"
        />
      </circle>
    </svg>
  );
};
