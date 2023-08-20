# Glaukos

> Named after the greek sea god who was once a mortal fisherman. Inspired by the concept of making "god hooks" performant.

[![CI](https://img.shields.io/github/actions/workflow/status/InterBolt/glaukos/ci.yml?branch=main)](https://github.com/InterBolt/glaukos/actions?query=workflow%3ACI)
[![npm](https://img.shields.io/npm/v/@interbolt/glaukos)](https://www.npmjs.com/package/@interbolt/glaukos)
[![size](https://img.shields.io/bundlephobia/minzip/@interbolt/glaukos)](https://bundlephobia.com/result?p=@interbolt/glaukos)

God hooks **without the re-renders.**

_Warning: This is still somewhat experimental. Use at your own risk._

## Table of Contents

- [Motivation](#Motivation)
- [Installation](#Install)
- [Usage](#Usage)
- [api - Glaukos' default export](#DefaultExport)
- [api - **\<Provider \/\>**](#Provider)
- [api - **useStore(store => ({ ... }))**](#useStore)
- [api - **useHandlers()**](#useHandlers)
- [api - **\<BridgeProvider /\>**](#BridgeProvider)
- [Why not redux, zustand, or something else?](#Why)
- [Limitations](#Limitations)
- [Hire me](#Hire)

### <a id="Motivation"></a> Motivation

A common mistake new React devs make is to create one or several overly ambitious custom "god hook(s)" that contain tons of state and handlers. In a non-trivial React app these "god hooks" [cause potentially expensive re-renders](https://www.developerway.com/posts/why-custom-react-hooks-could-destroy-your-app-performance) any time one of their return value's references change. Experienced developers solve this problem by breaking their app logic in to multiple custom hooks, _deliberately_ using memoization, definining multiple context providers, and potentially incorporating a redux-like store for global state. But this can lead to a lot of boilerplate and hard to reason about state for anyone new to the application. Or worse, inexperienced developers start memoizing all of the things with React.useMemo and React.useCallback, leading to very annoying bugs down the road.

`@interbolt/glaukos` solves the re-render problem associated with these overly ambitious "god hooks" by allowing app developers to define a single `useGodHook` where they can compose as many custom hooks as needed **while never needing to worry about unnecessary dom re-renders when accessing its return value.** This is accomplished by using React's Context and Ref API under the hood along with [use-context-selector](https://github.com/dai-shi/use-context-selector).

### <a id="Install"></a> Installation

```bash
yarn add @interbolt/glaukos
```

This package requires some peer dependencies, which you need to install by yourself.

```bash
yarn add react react-dom scheduler
yarn add -D @types/react @types/react-dom
```

### <a id="Usage"></a> Usage

```tsx
import React from "react";
import ReactDOM from "react-dom";
import glaukos, { TGlaukos } from "@interbolt/glaukos";

const useGodHook = (): TGlaukos<{
  handlers: {
    onPurchaseSomething: (purchasedItem: string) => void;
    onSaveSomething: (savedItem: string) => void;
    onLike: (likedQuote: string) => void;
    onDecrement: () => void;
    onIncrement: () => void;
  };
  store: {
    count: number;
    quote: string;
    savedItems: string[];
    purchases: string[];
  };
}> => {
  // Arbitrary hooks to demonstrate composing multiple hooks in to a single "god hook".
  const { onSaveSomething, savedItems } = useSavedStuff();
  const { onPurchaseSomething, purchases } = usePurchase();

  // Stuff we'll use in this example
  const [likes, setLikes] = React.useState([]);
  const [count, setCount] = React.useState(0);
  const quotes = [
    `Nothing is impossible. The word itself says 'I'm possible!`,
    `There is nothing impossible to those who will try.`,
    `The bad news is time flies. The good news is you're the pilot.`,
  ];

  const quote = quotes[count % quotes.length];

  const onIncrement = () => {
    setCount((count) => count + 1);
  };

  const onDecrement = () => {
    setCount((count) => Math.max(0, count - 1));
  };

  const onLike = (likedQuote: string) => {
    setLikes((likes) =>
      likes.includes(likedQuote) ? likes : [...likes, likedQuote]
    );
  };

  React.useEffect(() => {
    let interval = setInterval(() => {
      onIncrement();
    }, 5000);
  }, []);

  return {
    handlers: {
      onPurchaseSomething,
      onSaveSomething,
      onLike,
      onIncrement,
      onDecrement,
    },
    store: {
      purchases,
      savedItems,
      quote,
      count,
    },
  };
};

const { Provider, useStore, useHandlers } = glaukos(useGodHook);

const Counter = () => {
  // No matter how many things are going on inside your "god hook", this component
  // only re-renders when store.count changes.
  const { count } = useStore((store) => ({
    count: store.count,
  }));

  // Accessing handlers from your "god hook" will never cause re-renders.
  const { onIncrement, onDecrement } = useHandlers();

  return (
    <div>
      <button onClick={onIncrement}>+</button>
      <span>Quote #{count}</span>
      <button onClick={onDecrement}>-</button>
      <ExpensiveRenderTree />
    </div>
  );
};

const MotivationalQuote = () => {
  // Again, no matter how many things are going on inside your "god hook", this component
  // only re-renders when store.quote changes.
  const { quote } = useStore((store) => ({
    quote: store.quote,
  }));

  // Again, accessing handlers from your "god hook" will never cause re-renders.
  const { onLike } = useHandlers();

  return (
    <div>
      {quote}
      <button onClick={onLike}>Like</button>
      <ExpensiveRenderTree />
    </div>
  );
};

const App = () => {
  return (
    <div>
      <Purchases />
      <SavedStuff />
      <Counter />
      <MotivationalQuote />
    </div>
  );
};

const AppRoot = () => {
  return (
    <Provider>
      <App />
    </Provider>
  );
};

ReactDOM.render(<AppRoot />, document.getElementById("app"));
```

### <a id="DefaultExport"></a> Glaukos' default export

The **glaukos** library exports a single function as its default export. The function takes a react hook as its only argument and returns two simple hooks and providers that can be used to access the value returned by your "god hook", all while guaranteeing that your application will never re-render on handler changes or unselected store value changes.

```typescript
// extremely simplified
type TGlaukos = { store: { ... }, handlers: { ... } }

type glaukos = (useGodHook: () => TGlaukos) => {
  // providers
  Provider: React.FC<{ children: JSX.Element, value: Glaukos }>;
  BridgeProvider: React.FC<{
    children: JSX.Element,
    renderer: (children: JSX.Element) => JSX.Element
  }>;
  // hooks
  useStore: (selector?: (store: Store) => Partial<Store>);
  useHandlers: () => Handlers;
};
```

- `Provider` - A React component that makes the `TGlaukos` value returned by your "god hook" available to all of its children.
- `useStore` - A hook that returns the store value. If a selector function is provided as the first parameter, it can be used to select a subset of the store value and only trigger a re-render when the selected value changes. Built on top of [use-context-selector](https://github.com/dai-shi/use-context-selector) and similar to the useSelector pattern in redux.
- `useHandlers` - A hook that returns all of your god hook's handlers. Calling this hook will never trigger a re-render even if the handlers you're accessing in your component change frequently.
- `BridgeProvider` - A Provider component for bridging the `TGlaukos` value to different render trees. This wraps [use-context-selector's BridgeProvider component](https://github.com/dai-shi/use-context-selector#bridgeprovider).

### <a id="Provider"></a> Provider

A context provider that takes a value prop with the following shape:

> _**important**: the below type is a simplification of the actual `TGlaukos` type which can be accessed and inspected by doing `import type { TGlaukos } from '@interbolt/glaukos'`. Ex: the actual `TGlaukos` type requires that all handlers be named with the prefix `on`. Ex: `onDoSomething` rather than `doSomething`_

```typescript
type TGlaukosSimplified = {
  handlers: Record<string, (...args: any[]) => any>;
  store: Record<string, AnythingButAFunction>;
};
```

### <a id="useStore"></a> useStore

A hook that returns the `TGlaukos.store` from within any child component of the `Provider`. If a selector function is provided as the first parameter, it will be used to select a subset of the store value and only trigger a re-render when the selected value changes.

#### Parameters

- `selector?: (store: Store) => Partial<Store>` - If no selector is provided, the entire store value will be returned and any change to the store will trigger a re-render.

#### Conceptual Usage

```typescript
// Assume the following store type:
type Store = {
  count: number;
  quote: string;
  savedItems: string[];
  purchases: string[];
};

// WITH SELECTOR:
// A re-render will only happen when the quote changes.
const { quote } = useStore((store) => ({
  quote: store.quote,
}));

// WITHOUT SELECTOR:
// A re-render will happen any time the following values change:
// store.count, store.quote, store.likes, store.savedItems, or store.purchases.
// note: reference changes are ignored via automatic deep memoization
const { quote } = useStore();
```

### <a id="useHandlers"></a> useHandlers

This hook returns `TGlaukos.handlers`. Calling this hook will never trigger a re-render even if the handlers change. This is achieved using a React ref that tracks changes to the handlers under the hood.

#### Conceptual Usage

```typescript
// Assume the following handlers type:
type Handlers = {
  onPurchaseSomething: (purchasedItem: string) => void;
  onSaveSomething: (savedItem: string) => void;
  onLike: (likedQuote: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
};

// No matter which handlers you access a re-render will never happen when calling useHandlers
const { onLike } = useHandlers();
```

### <a id="BridgeProvider"></a> BridgeProvider

Its common for UI libraries to include components like modals that are rendered in a seperate tree. As a result React.useContext loses access to its provider value when used in these seperate render trees. **glaukos** uses the React Context API under the hood which means **useStore** and **useHandlers** will lose access to the god hook's return value unless we "bridge" the context over to the new render tree likeso:

#### Parameters

- `renderer: (children: JSX.Element) => JSX.Element` - Should render the component that is responsible for creating a new render tree.

#### Conceptual Usage

```tsx
<BridgeProvider
  renderer={(children) => (
    <UiComponentWithNewRenderTree>{children}</UiComponentWithNewRenderTree>
  )}
>
  <ComponentThatCanNowAccessContext />
</BridgeProvider>
```

## <a id="Why"></a>Why not [redux](https://redux.js.org/), [zustand](https://github.com/pmndrs/zustand), or something similar?

These libraries are perfectly fine for most use-cases but the goal of **glaukos** is to provide a simpler programming model where state management, handlers, and effects are all "just a hook". Let's cherry pick the following code at the top of the zustand readme:

```typescript
import { create } from "zustand";

const useBearStore = create((set) => ({
  bears: 0,
  increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
  removeAllBears: () => set({ bears: 0 }),
}));
```

This is a nice way to manage state but it requires you to learn a new API when most react devs already know React.useState and React.useReducer quite well. Let's rewrite the zustand code above using **glaukos**:

```typescript
const useGlaukosGodHook = () => {
  const [bears, setBears] = React.useState(0);
  const onIncreasePopulation = () => setBears((bears) => bears + 1);
  const onRemoveAllBears = () => setBears(0);

  return {
    store: {
      bears,
    },
    handlers: {
      onIncreasePopulation,
      onRemoveAllBears,
    },
  };
};
```

Despite the fact that the zustand code is more terse, it assumes we know what `create` does, `set` does, what other params `create` might have, and how to use the `useBearStore` hook. In the **glaukos** example we only need to understand how to use `React.useState` hook to define our logic. This is a simple example but the same concept applies to more complicated state management scenarios. Admittedly, the **glaukos** way of managing state and effects is less performant out of the box than zustand but its a reasonable tradeoff for a simpler programming model where we don't have to learn new api's or think about downstream dom re-renders.

In summary, the point of **glaukos** is to do away with needing to learn new state management api's and instead use the React hook APIs devs already know.

## <a id="Limitations"></a> Limitations

- This library will never prevent you from writing computationally expensive code inside your "god hook" and blocking the main JS thread. For that, consider using additional libraries like [valtio-yjs](https://github.com/dai-shi/valtio-yjs) and some common sense.
- I use the phrase "god hook" to encourage a simple programming model but if there's no getting around excessive computations in your "god hook", there's nothing stopping you from using multiple glaukos providers to define different sets of stores and handlers. This can potentially be a good idea for very large applications.

## <a id="Hire"></a> Hire Me

I do advanced React consulting on a retainer basis. Reach out a cc13.engineering@gmail.com if you're interested.
