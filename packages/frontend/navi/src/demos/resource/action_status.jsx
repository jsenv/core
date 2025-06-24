import { useActionStatus } from "@jsenv/navi";
import { stringifyForDisplay } from "../../actions_helpers.js";

export const ActionStatus = ({ action, name = action.name }) => {
  const { idle, preloaded, active, pending, params, error, aborted, data } =
    useActionStatus(action);
  return (
    <fieldset style={{ width: "200px" }}>
      <legend>{name}</legend>

      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div>
          <span>
            <span>loading state:</span>{" "}
            <strong>
              {idle
                ? "idle"
                : aborted
                  ? "aborted"
                  : error
                    ? "error"
                    : pending
                      ? "pending"
                      : preloaded
                        ? "preloaded"
                        : "loaded"}
            </strong>
          </span>
        </div>
        <div>
          {active ? (
            <span>
              active: <strong>yes</strong>
            </span>
          ) : (
            <span>active: no</span>
          )}
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <span>params: </span>
          <pre style="margin: 0">{stringifyForDisplay(params)}</pre>
        </div>
        <div>
          {data ? (
            <span>
              data: <strong>{stringifyForDisplay(data)}</strong>
            </span>
          ) : (
            <span>data</span>
          )}
        </div>
      </div>
    </fieldset>
  );
};
