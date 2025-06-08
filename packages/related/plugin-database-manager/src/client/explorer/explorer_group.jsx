/**
 *
 */

import { Route, valueInLocalStorage } from "@jsenv/router";
import { effect, signal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { ExplorerItemList } from "./explorer_item_list.jsx";

export const createExplorerGroupController = (id) => {
  const [restoreHeight, storeHeight] = valueInLocalStorage(
    `explorer_group_${id}_height`,
    {
      type: "positive_number",
    },
  );
  const heightSettingSignal = signal(restoreHeight());
  effect(() => {
    const height = heightSettingSignal.value;
    storeHeight(height);
  });

  const useHeightSetting = () => {
    return heightSettingSignal.value;
  };
  const setHeightSetting = (width) => {
    heightSettingSignal.value = width;
  };

  return { id, useHeightSetting, setHeightSetting };
};

export const ExplorerGroup = forwardRef(
  (
    {
      controller,
      detailsRoute,
      idKey,
      nameKey,
      children,
      labelChildren,
      renderItem,
      createNewButtonChildren,
      useItemList,
      useItemRouteIsActive,
      useRenameItemAction,
      useCreateItemAction,
      useDeleteItemAction,
      onOpen,
      onClose,
      resizable,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    useLayoutEffect(() => {
      setTimeout(() => {
        innerRef.current.setAttribute("data-details-toggle-animation", "");
      });
    }, []);

    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const startCreatingNew = useCallback(() => {
      setIsCreatingNew(true);
    }, [setIsCreatingNew]);
    const stopCreatingNew = useCallback(() => {
      setIsCreatingNew(false);
    }, [setIsCreatingNew]);

    const heightSetting = controller.useHeightSetting();

    return (
      <>
        {resizable && <div data-resize-handle={controller.id}></div>}
        <Route.Details
          {...rest}
          route={detailsRoute}
          ref={innerRef}
          id={controller.id}
          className="explorer_group"
          onToggle={(toggleEvent) => {
            if (toggleEvent.newState === "open") {
              if (onOpen) {
                onOpen();
              }
            } else if (onClose) {
              onClose();
            }
          }}
          data-resize={resizable ? "vertical" : "none"}
          data-min-height="150"
          data-requested-height={heightSetting}
          renderLoaded={() => (
            <div className="explorer_group_content">
              <ExplorerItemList
                idKey={idKey}
                nameKey={nameKey}
                renderItem={renderItem}
                useItemList={useItemList}
                useItemRouteIsActive={useItemRouteIsActive}
                useRenameItemAction={useRenameItemAction}
                useCreateItemAction={useCreateItemAction}
                useDeleteItemAction={useDeleteItemAction}
                isCreatingNew={isCreatingNew}
                stopCreatingNew={stopCreatingNew}
              >
                {children}
              </ExplorerItemList>
            </div>
          )}
        >
          {labelChildren}
          <span style="display: flex; flex: 1"></span>
          <button
            className="summary_action_icon"
            style="width: 22px; height: 22px; cursor: pointer;"
            onMouseDown={(e) => {
              // ensure when input is focused it stays focused
              // without this preventDefault() the input would be blurred (which might cause creation of an item) and re-opened empty
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              startCreatingNew();
            }}
          >
            {createNewButtonChildren}
          </button>
        </Route.Details>
      </>
    );
  },
);
