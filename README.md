# Glaukos

"God hooks" **without the re-renders.**

> Glaukos is the name of a greek sea god who was once a mortal fisherman.

[![CI](https://img.shields.io/github/actions/workflow/status/InterBolt/glaukos/ci.yml?branch=release)](https://github.com/InterBolt/glaukos/actions?query=workflow%3ACI)
[![npm](https://img.shields.io/npm/v/@interbolt/glaukos)](https://www.npmjs.com/package/@interbolt/glaukos)
[![size](https://img.shields.io/bundlephobia/minzip/@interbolt/glaukos)](https://bundlephobia.com/result?p=@interbolt/glaukos)

# Table of Contents

- [Motivation](#-motivation)
- [Install](#install-required-peer-dependency)
- [Usage](#usage)
- [When to use?](#when-to-use)
- [API](#api)
- [How to test?](#how-to-test)
- [Why not vanilla React contexts, redux, or something like Zustand?](#why-not-vanilla-react-contexts-redux-or-something-like-zustand)

_Warning: This is experimental. Use at your own risk._

# Motivation

A common mistake React devs make is to create one or several overly ambitious custom "god hook(s)" that contain too much state and too many handlers. In a non-trivial React app these custom hooks [cause potentially expensive re-renders](https://www.developerway.com/posts/why-custom-react-hooks-could-destroy-your-app-performance) any time one of their return value's references change. Experienced developers solve this problem by breaking their app logic in to multiple custom hooks, _deliberately_ using memoization, definining multiple context providers, and potentially incorporating a redux-like store for global state. But this can lead to a lot of boilerplate and hard to reason about state for anyone new to the application.

`@interbolt/glaukos` solves the re-render problem associated with these overly ambitious custom hooks by allowing app developers to define a single `useScreenHook` where they can compose as many custom hooks as needed **while never needing to worry about unnecessary dom re-renders when accessing its return value.** This is accomplished by using React's Context and Ref API under the hood along with [use-context-selector](https://github.com/dai-shi/use-context-selector).

# Installation

```bash
# scheduler is the only required peer dependency
yarn add scheduler @interbolt/glaukos
```

# Usage

```tsx
import React from "react";
import ReactDOM from "react-dom";
import setupContext, { TContextHookReturn } from "~lib/setupContext";

// Use this for screens or global state
const useScreenHook = (): TContextHookReturn<{
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
  refs: {
    counterDomRef: React.RefObject<HTMLDivElement>;
  };
}> => {
  // Arbitrary hooks to demonstrate that we can safely compose custom hooks
  // without worrying about re-renders.
  const { onSaveSomething, savedItems } = useSavedStuff();
  const { onPurchaseSomething, purchases } = usePurchase();

  // Stuff we'll use in this example
  const [likes, setLikes] = React.useState([]);
  const [count, setCount] = React.useState(0);
  const counterDomRef = React.useRef(null);

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

  // This would cause re-renders if calling this hook normally
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
    refs: {
      counterDomRef,
    },
  };
};

const { Provider, useStore, useHandlers, useRefs } =
  setupContext(useScreenHook);

const Counter = () => {
  // only triggers re-renders when store.count changes
  const { count } = useStore((store) => ({
    count: store.count,
  }));

  // no re-renders triggered when calling useRefs()
  const { counterDomRef } = useRefs();

  // no re-renders triggered when calling useHandlers()
  const { onIncrement, onDecrement } = useHandlers();

  return (
    <div ref={counterDomRef}>
      <button onClick={onIncrement}>+</button>
      <span>Quote #{count}</span>
      <button onClick={onDecrement}>-</button>
      <ExpensiveRenderTree />
    </div>
  );
};

const MotivationalQuote = () => {
  // only triggers re-renders when store.count changes
  const { quote } = useStore((store) => ({
    quote: store.quote,
  }));

  // no re-renders triggered when calling useHandlers()
  const { onLike } = useHandlers();

  return (
    <div>
      {quote}
      <button onClick={onLike}>Like</button>
      <ExpensiveRenderTree />
    </div>
  );
};

const Screen = () => {
  return (
    <div>
      <Purchases />
      <SavedStuff />
      <Counter />
      <MotivationalQuote />
    </div>
  );
};

const ScreenRoot = () => {
  return (
    <Provider>
      <Screen />
    </Provider>
  );
};

export default ScreenRoot;
```

# When to use?

`glaukos` works best when managing **_global state_** and
**_screen-wide_** state.

# API

The default export is a function called `glaukos` which takes a
React function hook as its first arg and an optional config object as its second.
Here’s an approximation of the type signature for `glaukos`:

```typescript
type TSetupContext = (
  useScreenHook: () => {
    store: Record<string, AnythingExceptAFunction>,
    handlers: Record<string, (...args: any) => any>,
    refs: <string, React.RefObject<HTMLDivElement>>
  },
  config?: {
    deepMemoize?: boolean
    forceAsyncHandlers?: boolean
  }
) => {
  Provider: React.FC<{ children: JSX.Element }>;
  BridgeProvider: React.FC<{
    children: JSX.Element;
    renderer: () => JSX.Element;
  }>;
  useStore: (selector?: (store: T) => Partial<T>) => Partial<T>;
  useHandlers: () => THandlers;
  useRefs: () => TRefs;
};

```

For the remainder of the docs, when I write `useScreenHook` I am
referring to the hook supplied the `glaukos` as its first param.

## useScreenHook

```typescript
type TSetupContext = (
  useScreenHook: () => {
    store: Record<string, AnythingExceptAFunction>,
    handlers: Record<string, (...args: any) => any>,
    refs: <string, React.RefObject<HTMLDivElement>>
  },
  ...
) => {
  ...
};
```

The return value of useScreenHook is strict but besides that it is
just a hook. There are no rules about what you can/can’t do inside of
`useScreenHook`.

## Config

```typescript
type TSetupContext = (
  ...,
  config: { deepMemoize: boolean }
) => {
  ...
};
```

The config object is optional and can be passed as the second argument
to the default export. The following config options are available:

### Props

- [optional, default=true] `deepMemoize: boolean` - When true, the
  store will be deep memoized. **_This is how we’re using it_** but can
  be turned off if memoization performance is causing more problems than
  a few extra re-renders.

- [optional, default=false] `forceAsyncHandlers: boolean` - When set to true, all handlers will be wrapped in a function that returns a promise. This is a slight optimization to ensure that handlers don't block the render lifecycle.

## Provider

```typescript
type TSetupContext = (
  ...,
  ...
) => {
  Provider,
  ...
};
```

A context provider to wrap your screen in. This provider will make
`useStore`, `useHandlers`, and `useRefs` hooks available to any child
component.

## useStore

```typescript
type TSetupContext = (
  ...,
  ...
) => {
  useStore,
  ...
};
```

This hook returns a subset of the `store` value returned by your
`useScreenHook` hook when a selector function is passed in. Re-renders
will only occur if the selected portion of the store changes. When no
selector is provided, the entire store value will be returned and any
change to the store will trigger a re-render.

### Parameters

1. [optional] `selector: store: Store) => Partial<Store>`

### Usage

```typescript
// Assume useContextHook returns the following store type:
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
// note: reference changes can be ignored by setting config.deepMemoize=true
const { quote } = useStore();
```

## useHandlers

```typescript
type TSetupContext = (
  ...,
  ...
) => {
  useHandlers,
  ...
};
```

This hook returns an up-to-date object containing all of the handlers
as defined in `useScreenHook` Calling this hook will never trigger a
re-render even if the handlers change.

When `config.forceAsyncHandlers` is set to true, all handlers will be wrapped in a function that returns a promise. This is a slight optimization to ensure that handlers don't block the render lifecycle.

> Uses a React ref that tracks changes to the handlers under the hood.

### Usage

```typescript
// Assume the following handlers type:
type Handlers = {
  onPurchaseSomething: (purchasedItem: string) => void
  onSaveSomething: (savedItem: string) => void
  onLike: (likedQuote: string) => void
  onDecrement: () => void
  onIncrement: () => void
}

// No matter which handlers you access a re-render will never happen
when calling useHandlers
const { onLike } = useHandlers()
```

## useRefs

```typescript
type TSetupContext = (
  ...,
  ...
) => {
  useRefs,
  ...
};
```

A hook that returns an object containing all of the refs provided in
`useScreenHook`. Accessing this hook will never cause a re-render.

### Usage

```typescript
// Assume the following handlers type:
type Refs = {
  counterDomRef: React.RefObject<HTMLDivElement>
}

// No matter which handlers you access a re-render will never happen
when calling useHandlers
const { counterDomRef } = useRefs()
```

## BridgeProvider

```typescript
type TSetupContext = (
  ...,
  ...
) => {
  BridgeProvider,
  ...
};
```

It’s common for UI libraries to include components like modals that
are rendered in a separate tree. As a result React.useContext loses
access to its provider value when used in these separate render trees.
`glaukos` uses the React Context API under the hood which means
`useStore` will lose access to the `useScreenHook`'s return value
unless we “bridge” the context over to the new render tree.

<aside>
💡 Technically, `useRefs` and `useHandlers` are accessible without a
bridge provider because their references are stored in a global state
object. But I recommend using bridge provider whenever you need to
access them nonetheless.

</aside>

### Props

- [required] `renderer: (children: JSX.Element) => JSX.Element` -
  Function to render the component that is responsible for creating a
  new render tree.

### Usage

```tsx
<BridgeProvider
  renderer={(children) => (
    <UiComponentWithNewRenderTree>{children}</UiComponentWithNewRenderTree>
  )}
>
  <ComponentThatCanNowAccessContext />
</BridgeProvider>
```

# How to test?

Because we define logic in a standard React hook we can do:

**SomeScreen.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom'
import setupContext, { TContextHookReturn } from '~lib/setupContext'

export const useScreenHook = () => {
  // put logic here

  return {
    handlers: {
      ...
    },
    store: {
      ...
    },
    refs: {
      ...
    },
  }
}

const { Provider, useStore, useHandlers, useRefs } = setupContext(useScreenHook)

const ScreenRoot = () => {
  return (
    <Provider>
      <Screen />
    </Provider>
  )
}

export default ScreenRoot
```

**SomeScreen.test.tsx**

```typescript
import { useScreenHook } from "./SomeScreen.tsx";

// write your test here with
// https://github.com/testing-library/react-hooks-testing-library
```

Hooks are easy to test but if `useScreenHook` is too monolithic to
test on its own, you can always test the hooks that it composes
instead. Whatever makes sense.

# Why not vanilla React contexts, redux, or something like Zustand?

The goal of `glaukos` is to consolidate ALL app logic (state,
effects, handlers) down to “just a few hooks”. This patterns makes
code more accessible to new programmers and sets us up to write more
meaningful tests.

## Zustand comparison

Lets look at the example zustand provides at the top of their docs.

```typescript
import { create } from "zustand";

const useBearStore = create((set) => ({
  bears: 0,
  increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
  removeAllBears: () => set({ bears: 0 }),
}));
```

Let’s rewrite the zustand code above using `glaukos`:

```typescript
import setupContext from '~lib/setupContext';

const useScreenHook = () => {
  const [bears, setBears] = React.useState(0)
  const onIncreasePopulation = () => setBears((bears) => bears + 1)
  const onRemoveAllBears = () => setBears(0)

  return {
    store: {
      bears,
    },
    handlers: {
      onIncreasePopulation,
      onRemoveAllBears,
    },
    refs: {}
  }
}

const { Provider } = setupContext(useScreenHook)

const YourScreen = () => {
  return (
    <Provider>
      <ScreenComponentA />
      <ScreenComponentB />
    </Provider>
  )
}

...
...
...
```

The zustand code is more terse but requires we learn some non-react
things like what `create` does, `set` does, what other params `create`
might have, and what other utilities we might need from the
`‘zustand’` library to build robust logic. In the **setupContext**
example we have to be more verbose and use a provider but in the
section where we define the logic we only need to understand how to
use `React.useState` hook works.

## Why not vanilla React contexts?

If we supply the output of a hook to a vanilla context provider we’ll
have to deal with lots of re-renders further down the render tree.
Vanilla react contexts should be used primarily for state that doesn’t
change often. From the react docs:

> All consumers that are descendants of a Provider will re-render whenever the Provider’s `value` prop changes. The propagation from Provider to its descendant consumers is not subject to the `shouldComponentUpdate` method, so the consumer is updated even when an ancestor component skips an update.

## Why not redux?

Redux is fine but once we can use hooks and distribute their return
values down a render tree without trigger re-renders it ends up being
redundant. If you really want reducer style state use
`React.useReducer` in the hook you pass to `glaukos`
