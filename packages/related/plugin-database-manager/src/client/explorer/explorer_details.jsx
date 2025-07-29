import { Details } from "@jsenv/navi";

import.meta.css = /* css */ `
  .explorer_details {
    flex: 1;
    padding-left: 16px;
  }
`;

export const ExplorerDetails = ({ label, children, ...props }) => {
  return (
    <Details className="explorer_details" {...props}>
      {[label, children]}
    </Details>
  );
};
