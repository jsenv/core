export const RectangleLoading2 = ({ color = "#383a36", radius = 0 }) => {
  // Calculate the perimeter of the rectangle
  const pathLength = 2 * (38 + 38) + 2 * Math.PI * radius;

  return (
    <svg
      viewBox="0 0 40 40"
      width="100%"
      height="100%"
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

      {/* Two segments moving in opposite directions */}
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
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={`${pathLength * 0.15} ${pathLength * 0.85}`}
      >
        {/* First segment animation - clockwise */}
        <animate
          attributeName="stroke-dashoffset"
          from={pathLength}
          to="0"
          dur="2s"
          repeatCount="indefinite"
        />
      </path>

      {/* Second segment - thinner and faster */}
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
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray={`${pathLength * 0.08} ${pathLength * 0.92}`}
      >
        {/* Second segment animation - counter-clockwise and faster */}
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={pathLength}
          dur="1.4s"
          repeatCount="indefinite"
        />
      </path>

      {/* Single leading dot */}
      <circle r="1.5" fill={color}>
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
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
};
