import React from 'react';

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
type TAnythingExceptAFunction = number | string | boolean | null | undefined | {
    bind: any;
    apply?: undefined;
    call: any;
} | {
    bind: any;
    apply: any;
    call?: undefined;
} | {
    bind?: undefined;
    apply: any;
    call: any;
} | {
    call?: undefined;
    apply?: undefined;
    bind?: undefined;
    [key: string]: any;
};
/**
 * @description forces all handler types to return a promise if they don't already
 */
type TForcedPromiseReturns<K extends Record<string, (...args: any[]) => any>> = {
    [k in keyof K]: K[k] extends (...args: any[]) => Promise<any> ? K[k] : (...args: Parameters<K[k]>) => Promise<ReturnType<K[k]>>;
};
type TGlaukosRefs = Record<string, any>;
type TGlaukosStore = Record<string, TAnythingExceptAFunction>;
/**
 * @description this is a bit of a hack to ensure that handlers are named with the prefix 'on'
 */
type TGlaukosHandlers<K> = Record<K extends `on${string}` ? K : `CUSTOM TS ERROR: Handler names must include prefix 'on'. ex:
onSomeEvent`, (...args: any[]) => any>;
/**
 * @description the return type required for the hook passed as the first param to 'glaukos'
 */
type TGlaukos<TValue extends {
    store?: TGlaukosStore;
    handlers?: TGlaukosHandlers<keyof TValue["handlers"]>;
    refs?: TGlaukosRefs;
}> = TValue;
/**
 * @description creates a set of hooks and components that can be used to access state and handlers
 * @param useHook - a user defined hook containing application logic
 * @param opts - optional config options
 * @returns { useStore, useHandlers, useRefs, Provider, BridgeProvider }
 */
declare const glaukos: <TConfigSupplied extends TConfig = any, TUseHookSupplied extends (...args: any[]) => {
    store: TGlaukosStore;
    handlers: TGlaukosHandlers<keyof ReturnType<TUseHookSupplied>["handlers"]>;
    refs: TGlaukosRefs;
} = any>(useHook: TUseHookSupplied, opts?: TConfigSupplied | undefined) => {
    useStore: <TSelector extends (store: ReturnType<TUseHookSupplied>["store"]) => Partial<ReturnType<TUseHookSupplied>["store"]> = (store: ReturnType<TUseHookSupplied>["store"]) => Partial<ReturnType<TUseHookSupplied>["store"]>>(selector?: TSelector | undefined) => ReturnType<TUseHookSupplied>["store"] | ReturnType<TSelector>;
    useHandlers: () => TConfigSupplied["forceAsyncHandlers"] extends true ? TForcedPromiseReturns<ReturnType<TUseHookSupplied>["handlers"]> : ReturnType<TUseHookSupplied>["handlers"];
    useRefs: () => ReturnType<TUseHookSupplied>["refs"];
    BridgeProvider: React.FC<{
        children: JSX.Element;
        renderer: (children: JSX.Element) => JSX.Element;
    }>;
    Provider: ({ children }: {
        children: JSX.Element;
    }) => React.JSX.Element;
};

export { TGlaukos, glaukos as default };
