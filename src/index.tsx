import { isEqual, uniqueId } from "lodash";
import React from "react";
import {
  BridgeProvider as BridgeProviderBase,
  createContext as createSelectableContext,
  useBridgeValue,
  useContextSelector,
  useContextUpdate,
} from "use-context-selector";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/* ------------------------------ Utility Types ----------------------------- */

type TImpossible<K extends keyof any> = {
  [P in K]: never;
};

type TNoExtraProperties<T, U extends T = T> = U &
  TImpossible<Exclude<keyof U, keyof T>>;

type TStringLiteral<T> = T extends `${string & T}` ? T : never;

// TODO: there's probably a less hacky way of doing this
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

type TForcedPromiseReturns<K extends Record<string, (...args: any[]) => any>> =
  {
    [k in keyof K]: K[k] extends (...args: any[]) => Promise<any>
      ? K[k]
      : (...args: Parameters<K[k]>) => Promise<ReturnType<K[k]>>;
  };

/* ---------------------------- Utility Hooks ------------------------------ */

const useDeepCompareMemoize = (value: React.DependencyList) => {
  const ref = React.useRef<React.DependencyList>([]);

  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
};

function useDeepCompareLayoutEffect<T>(
  factory: React.EffectCallback,
  dependencies: React.DependencyList
) {
  return useIsomorphicLayoutEffect(
    factory,
    useDeepCompareMemoize(dependencies)
  );
}

function useDeepCompareMemo<T>(
  factory: () => T,
  dependencies: React.DependencyList
) {
  return React.useMemo(factory, useDeepCompareMemoize(dependencies));
}

/* ------------------------------ Glaukos Types ----------------------------- */

type TGlaukosOpts<Name extends string = "Glaukos"> = {
  name: Name extends ""
    ? `CUSTOM TS ERROR: You must pass a non empty string as the 'name' property of the options object.`
    : Name;
};

type TGlaukosRefs = Record<string, any>;

type TGlaukosStore = Record<string, TAnythingExceptAFunction>;

type TGlaukosHandlers<K> = Record<
  K extends `on${string}`
    ? K
    : `CUSTOM TS ERROR: Handler names must include prefix 'on'. ex: onSomeEvent`,
  (...args: any[]) => any
>;

export type TGlaukosAPI<
  TValue extends {
    store?: TGlaukosStore;
    handlers?: TGlaukosHandlers<keyof TValue["handlers"]>;
    refs?: TGlaukosRefs;
  }
> = TValue;

/* ------------------------------ External State ---------------------------- */

const externalStore: {
  state: Record<
    string,
    {
      handlers: any;
      refs: any;
    }
  >;
  names: Record<string, boolean>;
} = {
  state: {},
  names: {},
};

/* ----------------------------- Custom Hooks ------------------------------- */

const useConcurrentStore = (ctx: any, store: any) => {
  const update = useContextUpdate(ctx);

  const [concurrentSafeStore, setConcurrentSafeStore] = React.useState(store);

  useDeepCompareLayoutEffect(() => {
    update(() => setConcurrentSafeStore(store), { suspense: true });
  }, [store]);

  const memoizedConcurrentStore = useDeepCompareMemo(
    () => concurrentSafeStore,
    [concurrentSafeStore]
  );

  return memoizedConcurrentStore;
};

/* ----------------------------------- API ---------------------------------- */

const glaukos = <
  TSuppliedOpts extends TGlaukosOpts<TSuppliedOptsName>,
  TSuppliedOptsName extends string = TSuppliedOpts["name"],
  TUseHookSupplied extends (...args: any[]) => TGlaukosAPI<{
    store: TGlaukosStore;
    handlers: TGlaukosHandlers<keyof ReturnType<TUseHookSupplied>["handlers"]>;
    refs: TGlaukosRefs;
  }> = any
>(
  useHook: TUseHookSupplied,
  opts: TNoExtraProperties<TGlaukosOpts<TSuppliedOptsName>, TSuppliedOpts>
) => {
  type TUseHookSuppliedReturn = ReturnType<TUseHookSupplied>;

  // Do a runtime check on the options so that JS users get a helpful error message
  if (typeof opts === "undefined") {
    throw new Error(
      `glaukos: You must pass an options object as the second argument to glaukos(_, opts).`
    );
  }

  if (typeof opts.name === "undefined") {
    throw new Error(
      `glaukos: You must pass a name as the 'name' property of the options object.`
    );
  }

  const { name } = opts;

  // Don't allow multiple glaukos instances to use the same name.
  // This makes IDE auto-complete easier and prevents confusion.
  if (typeof externalStore.names[name] !== "undefined") {
    const duplicateNameErrorMessage = `glaukos: Provider name '${name}' has already been used. Please use a unique name for each provider.`;
    if (process.env.NODE_ENV === "development") {
      throw new Error(duplicateNameErrorMessage);
    }
    console.error(duplicateNameErrorMessage);
  }

  // Use a unique id rather than rely on the uniqueness of the name.
  // Name uniqueness is only strongly enforced in development mode
  // and can't be caught by the compiler.
  const providerId = uniqueId();
  externalStore.state[providerId] = {
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
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              const response = (handlersRef.current as any)[key](...args);

              const isResponsePromise =
                typeof response === "object" &&
                response &&
                typeof response.then === "function";
              if (isResponsePromise) {
                response.then(resolve).catch(reject);
              } else {
                resolve(response);
              }
            });
          });
        };
      });

      // Store the proxied handlers and refs in a global state object so we can access them without needing to
      // pass them to the provider.
      externalStore.state[providerId].handlers = proxiedHandlers;
      externalStore.state[providerId].refs = sourceRefs;

      // Save the name in global state so we can check for duplicates.
      externalStore.names[name] = true;
    }, []);

    // Ensure children of our context provider don't rerender on store changes if they don't need to
    // access the store.
    const memoizedChildren = React.useMemo(() => children, []);
    const concurrentStore = useConcurrentStore(Context, store);

    return (
      <Context.Provider value={concurrentStore}>
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
  function useHandlers(): TForcedPromiseReturns<
    TUseHookSuppliedReturn["handlers"]
  > {
    return externalStore.state[providerId].handlers as TForcedPromiseReturns<
      TUseHookSuppliedReturn["handlers"]
    >;
  }

  // A hook to access the refs.
  // Accessing it will never cause a re-render
  function useRefs(): TUseHookSuppliedReturn["refs"] {
    return externalStore.state[providerId]
      .refs as TUseHookSuppliedReturn["refs"];
  }

  type ReturnedUseStore<
    Key extends TStringLiteral<string>,
    ReturnType extends any
  > = {
    [K in `use${Key}Store`]: ReturnType;
  };

  type ReturnedUseHandlers<
    Key extends TStringLiteral<string>,
    ReturnType extends any
  > = {
    [K in `use${Key}Handlers`]: ReturnType;
  };

  type ReturnedUseRefs<
    Key extends TStringLiteral<string>,
    ReturnType extends any
  > = {
    [K in `use${Key}Refs`]: ReturnType;
  };

  type ReturnedProvider<
    Key extends TStringLiteral<string>,
    ReturnType extends any
  > = {
    [K in `${Key}Provider`]: ReturnType;
  };

  type ReturnedBridgeProvider<
    Key extends TStringLiteral<string>,
    ReturnType extends any
  > = {
    [K in `${Key}BridgeProvider`]: ReturnType;
  };

  return {
    [`use${name}Store` as const]: useStore,
    [`use${name}Handlers` as const]: useHandlers,
    [`use${name}Refs` as const]: useRefs,
    [`${name}BridgeProvider` as const]: BridgeProvider,
    [`${name}Provider`]: Provider,
  } as any as ReturnedUseStore<TSuppliedOpts["name"], typeof useStore> &
    ReturnedUseHandlers<TSuppliedOpts["name"], typeof useHandlers> &
    ReturnedUseRefs<TSuppliedOpts["name"], typeof useRefs> &
    ReturnedBridgeProvider<TSuppliedOpts["name"], typeof BridgeProvider> &
    ReturnedProvider<TSuppliedOpts["name"], typeof Provider>;
};

export default glaukos;
