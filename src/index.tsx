import { isEqual, uniqueId } from "lodash";
import React from "react";
import {
  BridgeProvider as BridgeProviderBase,
  createContext as createSelectableContext,
  useBridgeValue,
  useContextSelector,
} from "use-context-selector";

/**
 * @description
 * Configuration options for glaukos
 *
 * @property {boolean} deepMemoize - if true, will use deep comparison when auto memoizing the store value
 * @note this is helpful if you have situations where nested objects in your store might change their reference despite
 * not changing their value. This is a performance optimization that can be used to prevent unnecessary re-renders.
 *
 * @property {boolean} forceAsyncHandlers - if true, will force all handlers to be async, regardless of definition
 * @note this is an optimization that ensures that the render lifecycle completes before and after handler is called
 * when we do await onSomeEvent() in the component.
 *
 * @example #1 CASE - forceAsyncHandlers=true
 * @note 'onSomeEvent' in this example is forced to become an async function despite not being defined as one.
 *
 * const useGlaukosHook = () => {
 *   return {
 *     handlers: {
 *       onSomeEvent: () => {
 *         return "some value"
 *       }
 *     }
 *   }
 * }
 * const config = { forceAsyncHandlers: true }
 * const { useHandlers } = glaukos(useGlaukosHook, config)
 *
 * const Component = () => {
 *   const { onSomeEvent } = useHandlers()
 *   const onClick = async () => {
 *     const value = await onSomeEvent()
 *     console.log(value) // will log "some value"
 *   }
 * }
 *
 * @example #2 CASE - deepMemoize=true
 * @note 'nestedObj' in this example changes its reference every second, but when we access it in the component,
 * it will only log once because of the deepMemoize config option.
 *
 * const useGlaukosHook = () => {
 *   const [nestedObj, setNestedObj] = React.useState([
 *     { id: 1, name: "foo" },
 *   ])
 *
 *   useEffect(() => {
 *     setInterval(() => { setNestedObj([{ id: 1, name: "foo" }]) }, 1000)
 *   }, [])
 *
 *   return {
 *     store: {
 *       nestedObj
 *     }
 *   }
 * }
 * const config = { deepMemoize: true }
 * const { useStore } = glaukos(useGlaukosHook, config)
 *
 * const Component = () => {
 *   const { nestedObj } = useStore()
 *   console.log(nestedObj) // will log ONLY once, despite the interval in the useGlaukosHook
 * }
 */
type TConfig = {
  deepMemoize?: boolean;
  forceAsyncHandlers?: boolean;
};

/**
 * @todo research better ways to do this.
 * This is a hacky way to get around needing to deal with generic types
 */
type TAnythingExceptAFunction =
  | number
  | string
  | boolean
  | null
  | undefined
  | { bind: any; apply?: undefined; call: any }
  | { bind: any; apply: any; call?: undefined }
  | { bind?: undefined; apply: any; call: any }
  | {
      call?: undefined;
      apply?: undefined;
      bind?: undefined;
      [key: string]: any;
    };

/**
 * @description forces all handler types to return a promise if they don't already
 */
type TForcedPromiseReturns<K extends Record<string, (...args: any[]) => any>> =
  {
    [k in keyof K]: K[k] extends (...args: any[]) => Promise<any>
      ? K[k]
      : (...args: Parameters<K[k]>) => Promise<ReturnType<K[k]>>;
  };
type TGlaukosRefs = Record<string, any>;
type TGlaukosStore = Record<string, TAnythingExceptAFunction>;

/**
 * @description this is a bit of a hack to ensure that handlers are named with the prefix 'on'
 */
type TGlaukosHandlers<K> = Record<
  K extends `on${string}`
    ? K
    : `CUSTOM TS ERROR: Handler names must include prefix 'on'. ex:
onSomeEvent`,
  (...args: any[]) => any
>;

/**
 * @description logic for deep memoization
 */
const useDeepCompareMemoize = (value: React.DependencyList) => {
  const ref = React.useRef<React.DependencyList>([]);

  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
};

/**
 * @description hook used to do the deep memoization
 */
function useDeepCompareMemo<T>(
  factory: () => T,
  dependencies: React.DependencyList
) {
  return React.useMemo(factory, useDeepCompareMemoize(dependencies));
}

/**
 * @description the return type required for the hook passed as the first param to 'glaukos'
 */
export type TGlaukos<
  TValue extends {
    store?: TGlaukosStore;
    handlers?: TGlaukosHandlers<keyof TValue["handlers"]>;
    refs?: TGlaukosRefs;
  }
> = TValue;

/**
 * @description store constant values for each glaukos provider instance
 */
const state: Record<
  string,
  {
    handlers: any;
    refs: any;
  }
> = {};

/**
 * @description creates a set of hooks and components that can be used to access state and handlers
 * @param useHook - a user defined hook containing application logic
 * @param opts - optional config options
 * @returns { useStore, useHandlers, useRefs, Provider, BridgeProvider }
 */
const glaukos = <
  TConfigSupplied extends TConfig = any,
  TUseHookSupplied extends (...args: any[]) => TGlaukos<{
    store: TGlaukosStore;
    handlers: TGlaukosHandlers<keyof ReturnType<TUseHookSupplied>["handlers"]>;
    refs: TGlaukosRefs;
  }> = any
>(
  useHook: TUseHookSupplied,
  opts?: TConfigSupplied
) => {
  type TUseHookSuppliedReturn = ReturnType<TUseHookSupplied>;

  const { deepMemoize = true, forceAsyncHandlers = false } = opts || {};

  const providerId = uniqueId();
  state[providerId] = {
    handlers: {},
    refs: {},
  };

  const Context = createSelectableContext<TUseHookSuppliedReturn["store"]>({
    store: {},
    handlers: {},
    refs: {},
  } as TUseHookSuppliedReturn);

  const Provider = ({ children }: { children: JSX.Element }) => {
    const {
      store = {},
      handlers: sourceHandlers = {},
      refs: sourceRefs = {},
    } = useHook();

    const handlersRef = React.useRef(sourceHandlers);
    React.useMemo(() => {
      handlersRef.current = sourceHandlers;
    }, [sourceHandlers]);

    // Store constant refs and the proxy to the up to date handlers
    // in a global state object so we can access them without needing to
    // pass them to the provider.
    React.useMemo(() => {
      // We cast the proxied handlers to their correct type further down in useHandlers() so we
      // cast them to any here for simplicity.
      const proxiedHandlers = {} as any;
      Object.keys(sourceHandlers).forEach((key) => {
        proxiedHandlers[key] = (...args: any[]) => {
          // Return functions as is.
          // Useful if introducing glaukos to an existing codebase where we can't easily refactor away all sync handlers.
          if (!forceAsyncHandlers) {
            return (handlersRef.current as any)[key](...args);
          }

          // Wrap all handlers in a promise so that we can use setTimeouts before and after to ensure that we don't
          // trigger re-renders before the previous render has finished and that we don't trigger re-renders in subsequent
          // renders if the handler is called multiple times.
          return new Promise((resolve, reject) => {
            setTimeout(async () => {
              try {
                const response = await (handlersRef.current as any)[key](
                  ...args
                );
                setTimeout(() => resolve(response));
              } catch (err) {
                reject(err);
              }
            });
          });
        };
      });

      // Store the proxied handlers and refs in a global state object so we can access them without needing to
      // pass them to the provider.
      state[providerId].handlers = proxiedHandlers;
      state[providerId].refs = sourceRefs;
    }, []);

    // Ensure children of our context provider don't rerender on store changes if they don't need to
    // access the store.
    const memoizedChildren = React.useMemo(() => children, []);

    // Memoize the store to prevent unnecessary re-renders.
    const memoizedStore = deepMemoize
      ? useDeepCompareMemo(() => store, [store])
      : React.useMemo(() => store, [store]);

    return (
      <Context.Provider value={memoizedStore}>
        {memoizedChildren}
      </Context.Provider>
    );
  };

  // Must be used to connect our store to new render trees.
  // This is common in UI libraries with a modal component.
  const BridgeProvider: React.FC<{
    children: JSX.Element;
    renderer: (children: JSX.Element) => JSX.Element;
  }> = (props) => {
    const { renderer, children } = props;
    const valueToBridge = useBridgeValue(Context);
    const memoizedChildren = React.useMemo(() => children, [children]);

    return renderer(
      <BridgeProviderBase context={Context} value={valueToBridge}>
        {memoizedChildren}
      </BridgeProviderBase>
    );
  };

  // A hook to access the store, either partially via a selector function
  // or in its entirety if no selector is passed.
  const useStore = <
    TSelector extends (
      store: TUseHookSuppliedReturn["store"]
    ) => Partial<TUseHookSuppliedReturn["store"]> = (
      store: TUseHookSuppliedReturn["store"]
    ) => Partial<TUseHookSuppliedReturn["store"]>
  >(
    selector?: TSelector
  ) => {
    const selected = useContextSelector<
      TUseHookSuppliedReturn["store"],
      unknown
    >(Context, (ctxStore) => {
      return selector ? selector(ctxStore) : ctxStore;
    });

    if (selector) {
      return selected as ReturnType<TSelector>;
    }

    return selected as TUseHookSuppliedReturn["store"];
  };

  // A hook to access the up to date handlers.
  // Accessing it will never cause a re-render
  function useHandlers(): TConfigSupplied["forceAsyncHandlers"] extends true
    ? TForcedPromiseReturns<TUseHookSuppliedReturn["handlers"]>
    : TUseHookSuppliedReturn["handlers"] {
    if (forceAsyncHandlers) {
      return state[providerId].handlers as TForcedPromiseReturns<
        TUseHookSuppliedReturn["handlers"]
      >;
    }
    return state[providerId].handlers as TUseHookSuppliedReturn["handlers"];
  }

  // A hook to access the refs.
  // Accessing it will never cause a re-render
  function useRefs(): TUseHookSuppliedReturn["refs"] {
    return state[providerId].refs as TUseHookSuppliedReturn["refs"];
  }

  return {
    useStore,
    useHandlers,
    useRefs,
    BridgeProvider,
    Provider,
  };
};

export default glaukos;
