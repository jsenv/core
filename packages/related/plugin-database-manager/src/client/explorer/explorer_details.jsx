import { SummaryMarker, valueInLocalStorage } from "@jsenv/navi";
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

export const ExplorerDetails = ({ id, label, children, ...props }) => {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [readOpened, storeOpened] = valueInLocalStorage(id, {
    type: "boolean",
  });
  const [open, setOpen] = useState(id ? readOpened() : null);

  return (
    <details
      id={id}
      className="explorer_details"
      {...props}
      onToggle={(toggleEvent) => {
        if (mountedRef.current) {
          if (toggleEvent.newState === "open") {
            if (id) {
              storeOpened(true);
            }
            setOpen(true);
          } else {
            if (id) {
              storeOpened(false);
            }
            setOpen(false);
          }
        }
      }}
      open={open}
    >
      <summary>
        <div className="summary_body">
          <SummaryMarker open={open} />
          <span className="summary_label">{label}</span>
        </div>
      </summary>
      {children}
    </details>
  );
};
