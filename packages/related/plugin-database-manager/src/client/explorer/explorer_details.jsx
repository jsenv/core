import { SummaryMarker } from "@jsenv/router";
import { useEffect, useRef, useState } from "preact/hooks";

import.meta.css = /* css */ `
  .explorer_details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .explorer_details > summary {
    flex-shrink: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    user-select: none;
  }
  .summary_body {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
  }
  .summary_label {
    display: flex;
    flex: 1;
    gap: 0.2em;
    align-items: center;
    padding-right: 10px;
  }
`;

export const ExplorerDetails = ({
  // role,
  children,
  ...props
}) => {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [open, setOpen] = useState(false);
  return (
    <details
      className="explorer_details"
      {...props}
      onToggle={(toggleEvent) => {
        if (mountedRef.current) {
          if (toggleEvent.newState === "open") {
            setOpen(true);
          } else {
            setOpen(false);
          }
        }
      }}
    >
      <summary>
        <div className="summary_body">
          <SummaryMarker open={open} />
          <span className="summary_label">{children}</span>
        </div>
      </summary>
      {/* Role details content goes here */}
    </details>
  );
};
