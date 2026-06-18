import { useLayoutEffect, useReducer } from "preact/hooks";

import { getUIStateControllerById } from "../../ui_state_controller.js";

const css = /* css */ `
  .debug-controller {
    margin-top: 10px;
    padding: 8px 12px;
    font-size: 12px;
    font-family: monospace;
    background: #f4f8ff;
    border: 1px solid #c8d8f0;
    border-radius: 6px;
  }
  .debug-controller-title {
    margin-bottom: 6px;
    color: #555;
    font-size: 11px;
  }
  .debug-controller-tree {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .debug-controller-node {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .debug-controller-indent {
    display: flex;
    margin-top: 2px;
    margin-left: 7px;
    padding-left: 16px;
    flex-direction: column;
    align-items: baseline;
    gap: 6px;
    gap: 2px;
    border-left: 2px solid #d0dff0;
  }
  .debug-controller-type {
    color: #1a56cc;
    font-weight: bold;
  }
  .debug-controller-type-leaf {
    color: #555;
    font-weight: bold;
  }
  .debug-controller-name {
    color: #c07000;
  }
  .debug-controller-state {
    color: #1a8c5c;
  }
  .debug-controller-delegated {
    color: #888;
    font-style: italic;
  }
`;

const ControllerNode = ({ controller, depth = 0 }) => {
  import.meta.css = css;
  const { controlType, name, uiState } = controller;
  const children = controller.getChildControllers?.();
  const isGroup = Boolean(children);
  const stateStr = JSON.stringify(uiState);

  return (
    <div>
      <div className="debug-controller-node">
        <span
          className={
            isGroup ? "debug-controller-type" : "debug-controller-type-leaf"
          }
        >
          {controlType}
        </span>
        {name && <span className="debug-controller-name">name="{name}"</span>}
        <span className="debug-controller-state">→ {stateStr}</span>
      </div>
      {children && children.length > 0 && (
        <div className="debug-controller-indent">
          {children.map((child, i) => (
            <ControllerNode key={i} controller={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const DebugUIStateController = ({ id }) => {
  import.meta.css = css;
  const [, forceUpdate] = useReducer((n) => n + 1, 0);

  const controller = getUIStateControllerById(id);

  useLayoutEffect(() => {
    if (!controller) {
      return undefined;
    }
    // Force a re-render immediately: by the time this layout effect runs,
    // all children have already registered (their layout effects run first),
    // so getChildControllers() now returns the complete tree.
    forceUpdate();
    return controller.subscribe(() => {
      forceUpdate();
    });
  }, [controller]);

  return (
    <div className="debug-controller">
      <div className="debug-controller-title">structure du controller</div>
      <div className="debug-controller-tree">
        {controller ? (
          <ControllerNode controller={controller} />
        ) : (
          <span style={{ color: "#aaa" }}>controller "{id}" introuvable</span>
        )}
      </div>
    </div>
  );
};
