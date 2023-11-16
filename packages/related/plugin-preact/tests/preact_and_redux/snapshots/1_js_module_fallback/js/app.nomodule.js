System.register([__v__("/js/main.nomodule.js")], function (_export, _context) {
  "use strict";

  var ReactReduxContext, useReduxContext, createReduxContextHook, useSelector, p, u, useStore, useDispatch, increment, decrement, counterValueSelector, App;
  /**
   * Hook factory, which creates a `useStore` hook bound to a given context.
   *
   * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
   * @returns {Function} A `useStore` hook bound to the specified context.
   */

  function createStoreHook(context = ReactReduxContext) {
    const useReduxContext$1 =
    // @ts-ignore
    context === ReactReduxContext ? useReduxContext :
    // @ts-ignore
    createReduxContextHook(context);
    return function useStore() {
      const {
        store
      } = useReduxContext$1(); // @ts-ignore

      return store;
    };
  }
  /**
   * A hook to access the redux store.
   *
   * @returns {any} the redux store
   *
   * @example
   *
   * import React from 'react'
   * import { useStore } from 'react-redux'
   *
   * export const ExampleComponent = () => {
   *   const store = useStore()
   *   return <div>{store.getState()}</div>
   * }
   */

  /**
   * Hook factory, which creates a `useDispatch` hook bound to a given context.
   *
   * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
   * @returns {Function} A `useDispatch` hook bound to the specified context.
   */

  function createDispatchHook(context = ReactReduxContext) {
    const useStore$1 =
    // @ts-ignore
    context === ReactReduxContext ? useStore : createStoreHook(context);
    return function useDispatch() {
      const store = useStore$1(); // @ts-ignore

      return store.dispatch;
    };
  }
  /**
   * A hook to access the redux `dispatch` function.
   *
   * @returns {any|function} redux store's `dispatch` function
   *
   * @example
   *
   * import React, { useCallback } from 'react'
   * import { useDispatch } from 'react-redux'
   *
   * export const CounterComponent = ({ value }) => {
   *   const dispatch = useDispatch()
   *   const increaseCounter = useCallback(() => dispatch({ type: 'increase-counter' }), [])
   *   return (
   *     <div>
   *       <span>{value}</span>
   *       <button onClick={increaseCounter}>Increase counter</button>
   *     </div>
   *   )
   * }
   */
  return {
    setters: [function (_mainJsx) {
      ReactReduxContext = _mainJsx.ReactReduxContext;
      useReduxContext = _mainJsx.useReduxContext;
      createReduxContextHook = _mainJsx.createReduxContextHook;
      useSelector = _mainJsx.useSelector;
      p = _mainJsx.p;
      u = _mainJsx.u;
    }],
    execute: function () {
      useStore = /*#__PURE__*/createStoreHook();
      useDispatch = /*#__PURE__*/createDispatchHook();
      increment = () => {
        return {
          type: "INCREMENT"
        };
      };
      decrement = () => {
        return {
          type: "DECREMENT"
        };
      };
      counterValueSelector = state => {
        return state.counter.value;
      };
      _export("App", App = ({
        onRender
      }) => {
        const counterValue = useSelector(counterValueSelector);
        const dispatch = useDispatch();
        p(() => {
          onRender();
        }, []);
        return u("p", {
          children: [u("button", {
            id: "increment",
            onClick: () => {
              dispatch(increment());
            },
            children: "+1"
          }), u("button", {
            id: "decrement",
            onClick: () => {
              dispatch(decrement());
            },
            children: "-1"
          }), u("span", {
            id: "counter_value",
            children: counterValue
          })]
        });
      });
    }
  };
});