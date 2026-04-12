import { Details } from "@jsenv/navi";

import.meta.css = /* css */ `
  .explorer_details {
    padding-left: 16px;
    flex: 1;
  }
`;

export const ExplorerDetails = ({ label, children, ...props }) => {
  return (
    <Details className="explorer_details" {...props}>
      {[label, children]}
    </Details>
  );
};
