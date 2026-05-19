import { elementIsFocusable, findAfter } from "@jsenv/dom";
import { useContext, useEffect, useRef } from "preact/hooks";

import { ActionRenderer } from "../../action/action_renderer.jsx";
import { Box } from "../../box/box.jsx";
import { useKeyboardShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { useFocusGroup } from "../../utils/focus/use_focus_group.js";
import { ActionContext } from "../field_context.js";
import { useFieldInterfaceProps } from "../field_hooks.jsx";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";
import { SummaryMarker } from "./summary_marker.jsx";

const css = /* css */ `
  .navi_details {
    position: relative;
    z-index: 1;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;

    summary {
      display: flex;
      flex-shrink: 0;
      flex-direction: column;
      cursor: pointer;
      user-select: none;

      &:focus {
        z-index: 1;
      }

      .navi_summary_body {
        display: flex;
        width: 100%;
        flex-direction: row;
        align-items: center;
        gap: 0.2em;

        .navi_summary_label {
          display: flex;
          flex: 1;
          align-items: center;
          gap: 0.2em;
        }
      }
    }
  }
`;

export const Details = (props) => {
  const refDefault = useRef();
  props.ref = props.ref || refDefault;
  props.value = props.value === undefined ? "on" : props.value;

  const details = <DetailsField {...props} />;
  return details;
};

const DetailsField = (props) => {
  import.meta.css = css;
  const {
    ref,
    persists,
    label = "Summary",
    loading,
    focusGroup,
    focusGroupDirection,
    arrowKeyShortcuts = true,
    openKeyShortcut = "ArrowRight",
    closeKeyShortcut = "ArrowLeft",
    onToggle,
  } = props;
  const fieldInterfaceProps = useFieldInterfaceProps(
    {
      resetOnCancel: true,
      resetOnAbort: true,
      resetOnError: true,
      // errors are shown by ActionRenderer inside <details>, not as validation messages
      actionErrorEffect: "none",
      ...props,
    },
    {
      fieldType: "details",
      readUIState: () => {
        const details = ref.current;
        const opened = details.open;
        return opened ? props.value : undefined;
      },
      statePropName: "open",
      defaultStatePropName: "defaultOpen",
      fallbackState: false,
      getStateFromProp: (open) => (open ? props.value : undefined),
      getPropFromState: Boolean,
      persists,
    },
  );
  const { value, children } = fieldInterfaceProps;
  const open = Boolean(value);

  useFocusGroup(ref, {
    enabled: focusGroup,
    name: typeof focusGroup === "string" ? focusGroup : undefined,
    direction: focusGroupDirection,
  });

  /**
   * Browser will dispatch "toggle" event even if we set open={true}
   * When rendering the component for the first time
   * We have to ensure the initial "toggle" event is ignored.
   *
   * If we don't do that code will think the details has changed and run logic accordingly
   * For example it will try to navigate to the current url while we are already there
   *
   * See:
   * - https://techblog.thescore.com/2024/10/08/why-we-decided-to-change-how-the-details-element-works/
   * - https://github.com/whatwg/html/issues/4500
   * - https://stackoverflow.com/questions/58942600/react-html-details-toggles-uncontrollably-when-starts-open
   *
   */

  const summaryRef = useRef(null);
  useKeyboardShortcuts(ref, [
    {
      key: openKeyShortcut,
      enabled: arrowKeyShortcuts,
      when: (e) =>
        document.activeElement === summaryRef.current &&
        // avoid handling openKeyShortcut twice when keydown occurs inside nested details
        !e.defaultPrevented,
      action: (e) => {
        const details = ref.current;
        if (!details.open) {
          e.preventDefault();
          details.open = true;
          return;
        }
        const summary = summaryRef.current;
        const firstFocusableElementInDetails = findAfter(
          summary,
          elementIsFocusable,
          { root: details },
        );
        if (!firstFocusableElementInDetails) {
          return;
        }
        e.preventDefault();
        firstFocusableElementInDetails.focus();
      },
    },
    {
      key: closeKeyShortcut,
      enabled: arrowKeyShortcuts,
      when: () => {
        const details = ref.current;
        return details.open;
      },
      action: (e) => {
        const details = ref.current;
        const summary = summaryRef.current;
        if (document.activeElement === summary) {
          e.preventDefault();
          summary.focus();
          details.open = false;
        } else {
          e.preventDefault();
          summary.focus();
        }
      },
    },
  ]);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
  }, []);

  return (
    <Box
      as="details"
      {...fieldInterfaceProps}
      baseClassName="navi_details"
      onToggle={(e) => {
        onToggle?.(e);
        if (!mountedRef.current) {
          return;
        }
        const details = ref.current;
        dispatchRequestAction(details, {
          event: e,
        });
      }}
      open={open}
    >
      <summary ref={summaryRef}>
        <div className="navi_summary_body">
          <SummaryMarker open={open} loading={loading} />
          <div className="navi_summary_label">{label}</div>
        </div>
      </summary>
      <DetailsFieldContent>{children}</DetailsFieldContent>
    </Box>
  );
};

// TODO: this is not really what we should be doing here:
// the action should run on open and be aborted on close
// instead we treat the details as a field
// so it needs to be updated to work as designed (for later as we don't use details for now)
//  onOpen={(e) => {
//       dispatchRequestAction(e.target, {
//         event: e,
//         requester: e.target,
//       });
//       onOpen?.(e);
//     }}
//     onClose={(e) => {
//       effectiveAction.abort();
//       onClose?.(e);
//     }}
const DetailsFieldContent = ({ children }) => {
  const action = useContext(ActionContext);

  return <ActionRenderer action={action}>{children}</ActionRenderer>;
};
