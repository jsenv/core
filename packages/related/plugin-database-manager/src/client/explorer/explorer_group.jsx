/**
 *
 */

import { SINGLE_SPACE_CONSTRAINT, useInputConstraint } from "@jsenv/form";
import {
  SPAInputText,
  SPALink,
  useDetails,
  valueInLocalStorage,
} from "@jsenv/router";
import { effect, signal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { FontSizedSvg } from "../font_sized_svg.jsx";

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
      urlParam,
      idKey,
      nameKey,
      children,
      labelChildren,
      ItemComponent,
      createNewButtonChildren,
      useItemList,
      useItemRouteUrl,
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
    const { open, onToggle } = useDetails(urlParam);

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
        <details
          {...rest}
          ref={innerRef}
          id={controller.id}
          className="explorer_group"
          open={open}
          onToggle={(toggleEvent) => {
            onToggle(toggleEvent);
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
        >
          <summary>
            <div className="summary_body">
              <span
                className="summary_marker"
                style="width: 24px; height: 24px"
              >
                <ArrowDown />
              </span>
              <span className="summary_label">
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
              </span>
            </div>
          </summary>
          <div className="explorer_group_content">
            <ul className="explorer_group_list">
              {children.map((item) => {
                return (
                  <li className="explorer_group_item" key={item[idKey]}>
                    <ExplorerGroupItem
                      idKey={idKey}
                      nameKey={nameKey}
                      item={item}
                      ItemComponent={ItemComponent}
                      useItemList={useItemList}
                      useItemRouteUrl={useItemRouteUrl}
                      useItemRouteIsActive={useItemRouteIsActive}
                      useRenameItemAction={useRenameItemAction}
                      useDeleteItemAction={useDeleteItemAction}
                    />
                  </li>
                );
              })}
              {isCreatingNew && (
                <li className="explorer_group_item">
                  <NewItem
                    nameKey={nameKey}
                    useCreateItemAction={useCreateItemAction}
                    onCancel={() => {
                      // si on a rien rentré on le cré pas, sinon oui on le cré
                      stopCreatingNew();
                    }}
                    onSubmitEnd={() => {
                      stopCreatingNew();
                    }}
                  />
                </li>
              )}
            </ul>
          </div>
        </details>
      </>
    );
  },
);
const ArrowDown = () => {
  return (
    <svg
      viewBox="0 -960 960 960"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z" />
    </svg>
  );
};

const ExplorerGroupItem = ({
  idKey,
  nameKey,
  item,
  ItemComponent,
  useItemList,
  useItemRouteUrl,
  useItemRouteIsActive,
  useRenameItemAction,
  useDeleteItemAction,
}) => {
  const itemName = item[nameKey];
  const deleteAction = useDeleteItemAction(item);
  const routeUrl = useItemRouteUrl(item);

  const linkRef = useRef();
  const [isRenaming, setIsRenaming] = useState(false);
  const startRenaming = useCallback(() => {
    setIsRenaming(true);
  }, [setIsRenaming]);
  const stopRenaming = useCallback(() => {
    setIsRenaming(false);
  }, [setIsRenaming]);

  const prevIsRenamingRef = useRef(isRenaming);
  const autoFocus = prevIsRenamingRef.current && !isRenaming;
  prevIsRenamingRef.current = isRenaming;

  return (
    <SPALink
      key={item[idKey]}
      ref={linkRef}
      href={routeUrl}
      autoFocus={autoFocus}
      className="explorer_group_item_content"
      deleteShortcutAction={deleteAction}
      deleteShortcutConfirmContent={`Are you sure you want to delete "${itemName}"?`}
      onKeydown={(e) => {
        if (e.key === "Enter" && !isRenaming) {
          e.preventDefault();
          e.stopPropagation();
          startRenaming();
        }
      }}
    >
      <ItemComponent item={item} />
      <ItemNameOrRenameInput
        nameKey={nameKey}
        item={item}
        useItemList={useItemList}
        useItemRouteUrl={useItemRouteUrl}
        useItemRouteIsActive={useItemRouteIsActive}
        useRenameItemAction={useRenameItemAction}
        isRenaming={isRenaming}
        stopRenaming={stopRenaming}
      />
    </SPALink>
  );
};

const ItemNameOrRenameInput = ({
  nameKey,
  item,
  useItemList,
  useItemRouteIsActive,
  useRenameItemAction,
  isRenaming,
  stopRenaming,
}) => {
  const itemName = item[nameKey];
  const itemRouteIsActive = useItemRouteIsActive(item);

  if (isRenaming) {
    return (
      <ItemRenameInput
        nameKey={nameKey}
        item={item}
        useItemList={useItemList}
        useRenameItemAction={useRenameItemAction}
        stopRenaming={stopRenaming}
      />
    );
  }
  return (
    <span
      style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        background: itemRouteIsActive ? "lightgrey" : "none",
      }}
    >
      {itemName}
    </span>
  );
};
const ItemRenameInput = ({
  nameKey,
  item,
  useItemList,
  useRenameItemAction,
  stopRenaming,
}) => {
  const itemList = useItemList();
  const renameAction = useRenameItemAction(item);
  const itemName = item[nameKey];
  const inputRef = useRef();
  const otherNameSet = new Set();
  for (const itemCandidate of itemList) {
    if (itemCandidate === item) {
      continue;
    }
    otherNameSet.add(itemCandidate[nameKey]);
  }
  useInputConstraint(inputRef, (input) => {
    const inputValue = input.value;
    const hasConflict = otherNameSet.has(inputValue);
    // console.log({
    //   inputValue,
    //   names: Array.from(otherNameSet.values()),
    //   hasConflict,
    // });
    if (hasConflict) {
      return `"${inputValue}" already exists. Please choose another name.`;
    }
    return "";
  });
  useInputConstraint(inputRef, SINGLE_SPACE_CONSTRAINT);

  return (
    <SPAInputText
      ref={inputRef}
      name={nameKey}
      autoFocus
      autoSelect
      required
      value={itemName}
      action={renameAction}
      onCancel={() => {
        stopRenaming();
      }}
      onSubmitEnd={() => {
        stopRenaming();
      }}
      onBlur={(e) => {
        if (e.target.value === itemName) {
          stopRenaming();
        }
      }}
    />
  );
};

const NewItem = ({ nameKey, useCreateItemAction, ...rest }) => {
  const action = useCreateItemAction();

  return (
    <span className="explorer_group_item_content">
      <FontSizedSvg>
        <EnterNameIconSvg />
      </FontSizedSvg>
      <SPAInputText
        name={nameKey}
        action={action}
        autoFocus
        required
        {...rest}
      />
    </span>
  );
};
const EnterNameIconSvg = ({ color = "currentColor" }) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M21.1213 2.70705C19.9497 1.53548 18.0503 1.53547 16.8787 2.70705L15.1989 4.38685L7.29289 12.2928C7.16473 12.421 7.07382 12.5816 7.02986 12.7574L6.02986 16.7574C5.94466 17.0982 6.04451 17.4587 6.29289 17.707C6.54127 17.9554 6.90176 18.0553 7.24254 17.9701L11.2425 16.9701C11.4184 16.9261 11.5789 16.8352 11.7071 16.707L19.5556 8.85857L21.2929 7.12126C22.4645 5.94969 22.4645 4.05019 21.2929 2.87862L21.1213 2.70705ZM18.2929 4.12126C18.6834 3.73074 19.3166 3.73074 19.7071 4.12126L19.8787 4.29283C20.2692 4.68336 20.2692 5.31653 19.8787 5.70705L18.8622 6.72357L17.3068 5.10738L18.2929 4.12126ZM15.8923 6.52185L17.4477 8.13804L10.4888 15.097L8.37437 15.6256L8.90296 13.5112L15.8923 6.52185ZM4 7.99994C4 7.44766 4.44772 6.99994 5 6.99994H10C10.5523 6.99994 11 6.55223 11 5.99994C11 5.44766 10.5523 4.99994 10 4.99994H5C3.34315 4.99994 2 6.34309 2 7.99994V18.9999C2 20.6568 3.34315 21.9999 5 21.9999H16C17.6569 21.9999 19 20.6568 19 18.9999V13.9999C19 13.4477 18.5523 12.9999 18 12.9999C17.4477 12.9999 17 13.4477 17 13.9999V18.9999C17 19.5522 16.5523 19.9999 16 19.9999H5C4.44772 19.9999 4 19.5522 4 18.9999V7.99994Z"
        fill={color}
      />
    </svg>
  );
};
