import { useKeyEffect } from "hooks/use_key_effect.js";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";
import { Message } from "/components/message/message.jsx";
import { useTextController } from "/components/text/text.jsx";

const DialogTextBoxComponent = (
  {
    color = "white",
    backgroundColor = "blue",
    children,
    overflow = "hidden",
    ...props
  },
  ref,
) => {
  const [text, textSetter] = useState(null);
  const textController = useTextController();
  const messageElementRef = useRef();
  const alertPromiseRef = useRef();
  const timeoutRef = useRef(null);

  const next = (event) => {
    if (textController.hasNext) {
      textController.next();
    } else {
      close(event);
    }
  };

  const close = (event) => {
    const alertPromise = alertPromiseRef.current;
    if (!alertPromise) {
      return null;
    }
    const eventType = event?.type;
    if (eventType !== "click" && eventType !== "keydown") {
      const timeout = timeoutRef.current;
      if (timeout !== null) {
        return alertPromise;
      }
    }
    textSetter(null);
    alertPromise.resolve();
    alertPromiseRef.current = null;
    return alertPromise;
  };

  useKeyEffect({
    Enter: {
      enabled: textController.hasContent,
      callback: (keyboardEvent) => {
        next(keyboardEvent);
      },
    },
    Space: {
      enabled: textController.hasContent,
      callback: (keyboardEvent) => {
        next(keyboardEvent);
      },
    },
  });

  const alert = (text, { timeout } = {}) => {
    textSetter(text);
    let _resolve;
    const alertPromise = new Promise((resolve) => {
      _resolve = resolve;
    });
    alertPromise.resolve = _resolve;
    alertPromiseRef.current = alertPromise;

    clearTimeout(timeoutRef.current);
    if (timeout) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        close();
      }, timeout);
    }

    return {
      promise: alertPromise,
      close,
    };
  };

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  useImperativeHandle(ref, () => {
    return {
      alert,
    };
  });

  return (
    <Message
      ref={messageElementRef}
      textController={textController}
      color={color}
      backgroundColor={backgroundColor}
      invisible={!text}
      overflow={overflow}
      width="100%"
      height="100%"
      maxWidth="100%"
      innerSpacingY="0.8em"
      innerSpacingX="0.5em"
      onClick={(clickEvent) => {
        next(clickEvent);
      }}
      {...props}
    >
      {text || children}
    </Message>
  );
};

export const DialogTextBox = forwardRef(DialogTextBoxComponent);
