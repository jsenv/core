// https://www.svgrepo.com/collection/zest-interface-icons/12
// https://flowbite.com/icons/

import { SvgIconGroup, SvgWithPlus } from "../svg/svg_composition.jsx";

export const pickRoleIcon = (role) => {
  if (!role.rolcanlogin) {
    if (role.rolsuper) {
      return SuperRoleGroupSvg;
    }
    return RoleGroupSvg;
  }
  if (role.rolsuper) {
    return SuperRoleCanLoginSvg;
  }
  return RoleCanLoginSvg;
};

export const RoleCanLoginSvg = ({
  color = "currentColor",
  headColor = "transparent",
  bodyColor = "transparent",
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {bodyColor && (
        <path
          d="M4.5 19.8C4.5 17.5 6.8 15 12 15C17.2 15 19.5 17.5 19.5 19.8C19.5 20.4 19.2 20.8 18.8 20.8H5.2C4.8 20.8 4.5 20.4 4.5 19.8Z"
          fill={bodyColor}
        />
      )}
      {headColor && <circle cx="12" cy="9" r="4" fill={headColor} />}
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8 9C8 6.79086 9.79086 5 12 5C14.2091 5 16 6.79086 16 9C16 11.2091 14.2091 13 12 13C9.79086 13 8 11.2091 8 9ZM15.8243 13.6235C17.1533 12.523 18 10.8604 18 9C18 5.68629 15.3137 3 12 3C8.68629 3 6 5.68629 6 9C6 10.8604 6.84668 12.523 8.17572 13.6235C4.98421 14.7459 3 17.2474 3 20C3 20.5523 3.44772 21 4 21C4.55228 21 5 20.5523 5 20C5 17.7306 7.3553 15 12 15C16.6447 15 19 17.7306 19 20C19 20.5523 19.4477 21 20 21C20.5523 21 21 20.5523 21 20C21 17.2474 19.0158 14.7459 15.8243 13.6235Z"
        fill={color}
        fill-opacity="1"
      />
    </svg>
  );
};
export const RoleCanLoginWithPlusSvg = ({ color }) => {
  return (
    <SvgWithPlus>
      <RoleCanLoginSvg color={color} />
    </SvgWithPlus>
  );
};
export const SuperRoleCanLoginSvg = ({
  color = "currentColor",
  hatColor = "transparent",
  headColor = "transparent",
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {headColor && (
        <path
          d="M8 10C8 12.2091 9.79086 14 12 14C14.2091 14 16 12.2091 16 10C16 9.4 15.87 8.83 15.63 8.31L12.45 9.89C12.17 10.03 11.83 10.03 11.55 9.89L8.37 8.31C8.13 8.83 8 9.4 8 10Z"
          fill={headColor}
        />
      )}
      {hatColor && (
        <path
          d="M4.55279 4.60557L11.5528 1.10557C11.8343 0.964809 12.1657 0.964809 12.4472 1.10557L19.4472 4.60557C19.786 4.77496 20 5.12123 20 5.5C20 5.87877 19.786 6.22504 19.4472 6.39443L12.4472 9.89443C12.1657 10.0352 11.8343 10.0352 11.5528 9.89443L4.55279 6.39443C4.214 6.22504 4 5.87877 4 5.5C4 5.12123 4.214 4.77496 4.55279 4.60557Z"
          fill={hatColor}
        />
      )}
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M12.4472 1.10557C12.1657 0.964809 11.8343 0.964809 11.5528 1.10557L4.55279 4.60557C4.214 4.77496 4 5.12123 4 5.5C4 5.87877 4.214 6.22504 4.55279 6.39443L6.58603 7.41105C6.21046 8.19525 6 9.07373 6 10C6 11.8604 6.84668 13.523 8.17572 14.6235C4.98421 15.7459 3 18.2474 3 21C3 21.5523 3.44772 22 4 22C4.55228 22 5 21.5523 5 21C5 18.7306 7.3553 16 12 16C16.6447 16 19 18.7306 19 21C19 21.5523 19.4477 22 20 22C20.5523 22 21 21.5523 21 21C21 18.2474 19.0158 15.7459 15.8243 14.6235C17.1533 13.523 18 11.8604 18 10C18 9.07373 17.7895 8.19525 17.414 7.41105L19.4472 6.39443C19.786 6.22504 20 5.87877 20 5.5C20 5.12123 19.786 4.77496 19.4472 4.60557L12.4472 1.10557ZM12 14C14.2091 14 16 12.2091 16 10C16 9.39352 15.8656 8.81975 15.6248 8.30566L12.4472 9.89443C12.1657 10.0352 11.8343 10.0352 11.5528 9.89443L8.37525 8.30566C8.13443 8.81975 8 9.39352 8 10C8 12.2091 9.79086 14 12 14ZM8.44695 6.10544L7.23607 5.5L12 3.11803L16.7639 5.5L15.5531 6.10544L12 7.88197L8.44695 6.10544Z"
        fill={color}
      />
    </svg>
  );
};

export const SuperRoleGroupSvg = ({ color = "currentColor" }) => {
  return (
    <SvgIconGroup>
      <SuperRoleCanLoginSvg color={color} />
    </SvgIconGroup>
  );
};
export const RoleGroupSvg = ({ color = "currentColor" }) => {
  return (
    <SvgIconGroup>
      <RoleCanLoginSvg color={color} />
    </SvgIconGroup>
  );
};
export const RoleGroupWithPlusSvg = ({ color }) => {
  return (
    <SvgWithPlus>
      <RoleGroupSvg color={color} />
    </SvgWithPlus>
  );
};

export const UserWithTickSvg = ({ color = "currentColor" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M3.41003 22C3.41003 18.13 7.26003 15 12 15C12.96 15 13.89 15.13 14.76 15.37"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M22 18C22 18.75 21.79 19.46 21.42 20.06C21.21 20.42 20.94 20.74 20.63 21C19.93 21.63 19.01 22 18 22C16.54 22 15.27 21.22 14.58 20.06C14.21 19.46 14 18.75 14 18C14 16.74 14.58 15.61 15.5 14.88C16.19 14.33 17.06 14 18 14C20.21 14 22 15.79 22 18Z"
        stroke={color}
        stroke-width="1.5"
        stroke-miterlimit="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M16.4399 18L17.4299 18.99L19.5599 17.02"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
export const UserWithCheckSvg = ({ color = "currentColor" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M10 5C8.34315 5 7 6.34315 7 8C7 9.65685 8.34315 11 10 11C11.6569 11 13 9.65685 13 8C13 6.34315 11.6569 5 10 5ZM13.5058 11.565C14.4281 10.6579 15 9.39576 15 8C15 5.23858 12.7614 3 10 3C7.23858 3 5 5.23858 5 8C5 9.39827 5.57396 10.6625 6.49914 11.5699C3.74942 12.5366 2 14.6259 2 17C2 17.5523 2.44772 18 3 18C3.55228 18 4 17.5523 4 17C4 15.2701 5.93073 13 10 13C12.6152 13 14.4051 13.9719 15.2988 15.1157C15.6389 15.5509 16.2673 15.628 16.7025 15.288C17.1377 14.9479 17.2148 14.3195 16.8748 13.8843C16.0904 12.8804 14.9401 12.0686 13.5058 11.565ZM22.6139 15.2106C23.0499 15.5497 23.1284 16.178 22.7894 16.6139L18.1227 22.6139C17.9485 22.8379 17.6875 22.9773 17.4045 22.9975C17.1216 23.0177 16.8434 22.9167 16.6392 22.7198L14.3059 20.4698C13.9083 20.0865 13.8968 19.4534 14.2802 19.0559C14.6635 18.6583 15.2966 18.6468 15.6941 19.0302L17.2268 20.5081L21.2106 15.3861C21.5497 14.9501 22.178 14.8716 22.6139 15.2106Z"
        fill={color}
      />
    </svg>
  );
};
export const UserWithShieldSvg = ({ color = "currentColor" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 21C4 17.4735 6.60771 14.5561 10 14.0709M19.8726 15.2038C19.8044 15.2079 19.7357 15.21 19.6667 15.21C18.6422 15.21 17.7077 14.7524 17 14C16.2923 14.7524 15.3578 15.2099 14.3333 15.2099C14.2643 15.2099 14.1956 15.2078 14.1274 15.2037C14.0442 15.5853 14 15.9855 14 16.3979C14 18.6121 15.2748 20.4725 17 21C18.7252 20.4725 20 18.6121 20 16.3979C20 15.9855 19.9558 15.5853 19.8726 15.2038ZM15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
