import { useActionStatus } from "@jsenv/navi";

export const ActionStatus = ({ action }) => {
  const { preloaded, active, pending, params, error, aborted, data } =
    useActionStatus(action);
  return (
    <fieldset style={{ width: "200px" }}>
      <legend>{action.name}</legend>

      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div>
          <span>
            <span>loading state:</span>{" "}
            <strong>
              {aborted
                ? "aborted"
                : error
                  ? "error"
                  : pending
                    ? "pending"
                    : active
                      ? "loaded"
                      : preloaded
                        ? "preloaded"
                        : "idle"}
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
          <pre style="margin: 0">{JSON.stringify(params)}</pre>
        </div>
        <div>
          {data ? (
            <span>
              data: <strong>{JSON.stringify(data)}</strong>
            </span>
          ) : (
            <span>data</span>
          )}
        </div>
      </div>
    </fieldset>
  );
};
