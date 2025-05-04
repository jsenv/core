import { useUrlBooleanParam } from "../url.js";

export const Details = ({ urlParam, children, ...props }) => {
  const [opened, openDetails, closeDetails] = useUrlBooleanParam(urlParam);

  return (
    <details
      {...props}
      open={opened}
      onToggle={(toggleEvent) => {
        if (toggleEvent.newState === "open") {
          openDetails();
        } else {
          closeDetails();
        }
        if (props.onToggle) {
          props.onToggle(toggleEvent);
        }
      }}
    >
      {children}
    </details>
  );
};
