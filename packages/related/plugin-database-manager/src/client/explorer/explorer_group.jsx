/**
 *
 */

import { Button, Details, valueInLocalStorage } from "@jsenv/navi";
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

export const createExplorerGroupController = (
  id,
  { detailsOpenAtStart, detailsOnToggle },
) => {
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

  return {
    id,
    useHeightSetting,
    setHeightSetting,
    detailsOpenAtStart,
    detailsOnToggle,
  };
};

export const ExplorerGroup = forwardRef((props, ref) => {
  const {
    controller,
    detailsAction,
    idKey,
    nameKey,
    labelChildren,
    renderNewButtonChildren,
    renderItem,
    useItemArrayInStore,
    useRenameItemAction,
    useCreateItemAction,
    useDeleteItemAction,
    useDeleteManyItemAction,
    onOpen,
    onClose,
    resizable,
    ...rest
  } = props;

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
  const stopCreatingNew = useCallback(
    ({ shouldRestoreFocus }) => {
      if (shouldRestoreFocus) {
        createButtonRef.current.focus();
      }
      setIsCreatingNew(false);
    },
    [setIsCreatingNew],
  );

  const heightSetting = controller.useHeightSetting();
  const createButtonRef = useRef(null);

  return (
    <>
      {resizable && (
        <div
          data-resize-handle={controller.id}
          id={`${controller.id}_resize_handle`}
        ></div>
      )}
      <Details
        {...rest}
        ref={innerRef}
        id={controller.id}
        open={controller.detailsOpenAtStart}
        className="explorer_group"
        onToggle={(toggleEvent) => {
          controller.detailsOnToggle(toggleEvent.newState === "open");
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
        action={detailsAction}
        label={
          <>
            {labelChildren}
            {renderNewButtonChildren ? (
              <>
                <span style="display: flex; flex: 1"></span>
                <Button
                  ref={createButtonRef}
                  className="summary_action_icon"
                  discrete
                  style={{
                    width: "22px",
                    height: "22px",
                    cursor: "pointer",
                    padding: "4px",
                  }}
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
                  {renderNewButtonChildren()}
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {(itemArray) => {
          return (
            <div className="explorer_group_content">
              <ExplorerItemList
                idKey={idKey}
                nameKey={nameKey}
                itemArray={itemArray}
                renderItem={renderItem}
                useItemArrayInStore={useItemArrayInStore}
                useRenameItemAction={useRenameItemAction}
                useCreateItemAction={useCreateItemAction}
                useDeleteItemAction={useDeleteItemAction}
                useDeleteManyItemAction={useDeleteManyItemAction}
                isCreatingNew={isCreatingNew}
                stopCreatingNew={stopCreatingNew}
              />
            </div>
          );
        }}
      </Details>
    </>
  );
});
