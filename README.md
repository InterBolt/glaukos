# Glaukos

> "God hooks" **without the re-renders.** _(Glaukos is the name of a greek sea god who was once a mortal fisherman.)_

[![CI](https://img.shields.io/github/actions/workflow/status/InterBolt/glaukos/ci.yml?branch=release)](https://github.com/InterBolt/glaukos/actions?query=workflow%3ACI)
[![npm](https://img.shields.io/npm/v/@interbolt/glaukos)](https://www.npmjs.com/package/@interbolt/glaukos)
[![size](https://img.shields.io/bundlephobia/minzip/@interbolt/glaukos)](https://bundlephobia.com/result?p=@interbolt/glaukos)

`@interbolt/glaukos` allows developers to compose lots of logic within a single React hook while automatically preventing unnecessary re-renders when accessing its return value.

# Table of Contents

- [Motivation](#motivation)
- [Install](#installation)
- [Usage](#usage)
- [API](#api)
- [How to test?](#how-to-test)

_Warning: This is experimental. Use at your own risk._

# Motivation

Everything you need to know in a single [blog post](https://interbolt.org/blog/glaukos).

# Installation

```bash
# first install peer dependency
yarn add scheduler

# then install glaukos
yarn @interbolt/glaukos
```

# Usage

```tsx
import React from "react";
import ReactDOM from "react-dom";
import glaukos from "@interbolt/glaukos";

// Use this for screens or global state
const useGlaukosHook = () => {
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

const { ScreenProvider, useScreenStore, useScreenHandlers, useScreenRefs } =
  glaukos(useGlaukosHook, { name: "Screen" });

const Counter = () => {
  // only triggers re-renders when store.count changes
  const { count } = useScreenStore((store) => ({
    count: store.count,
  }));

  // no re-renders triggered when calling useScreenRefs()
  const { counterDomRef } = useScreenRefs();

  // no re-renders triggered when calling useScreenHandlers()
  const { onIncrement, onDecrement } = useScreenHandlers();

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
  const { quote } = useScreenStore((store) => ({
    quote: store.quote,
  }));

  // no re-renders triggered when calling useScreenHandlers()
  const { onLike } = useScreenHandlers();

  return (
    <div>
      {quote}
      <button onClick={onLike}>Like</button>
      <ExpensiveRenderTree />
    </div>
  );
};

const ScreenUI = () => {
  return (
    <div>
      <Purchases />
      <SavedStuff />
      <Counter />
      <MotivationalQuote />
    </div>
  );
};

const Screen = () => {
  return (
    <ScreenProvider>
      <ScreenUI />
    </ScreenProvider>
  );
};

export default Screen;
```

# API

The default export of `@interbolt/glaukos` is a function called `glaukos` which takes a React function hook as its first param and an optional config object as its second param.

## glaukos parameters

### 1st - `useGlaukosHook` [required]

```typescript
type TUseGlaukosHook = () => {
  store: Record<string, AnythingExceptAFunction>,
  handlers: Record<string, (...args: any) => any>,
  refs: <string, React.RefObject<HTMLDivElement>>
}
```

Besides the required return type, there are no rules about what you can/can’t do inside of `useGlaukosHook`. It is just a react hook.

### 2nd - `config` [required]

```typescript
type TGlaukosConfig = {
  name: string; // cannot be an empty string!
};
```

#### Config Options

- `name` [required] - `string`: A unique name that dictates the return type of `glaukos`. ex: When config.name is `MyScreen` the return type will be:

  ```typescript
  type TReturnType = {
    useMyScreenStore: ...,
    useMyScreenHandlers: ...,
    useMyScreenRefs: ...,
    MyScreenProvider: ...,
    MyScreenBridgeProvider: ...,
  }
  ```

## glaukos return properties

`glaukos` returns an object containing the following properties:

- `use[Named]Store`
- `use[Named]Handlers`
- `use[Named]Refs`
- `[Named]Provider`
- `[Named]BridgeProvider`

Where **[Named]** is the value of `config.name` passed to `glaukos`.

### [Named]Provider

A provider to wrap your screen in. This provider will make `use[Named]Store`, `use[Named]Handlers`, and `use[Named]Refs` hooks available to any child component.

### use[Named]Store

This hook returns a subset of the `store` value returned by your
`useGlaukosHook` hook when a selector function is passed in. Re-renders
will only occur if the selected portion of the store changes. When no
selector is provided, the entire store value will be returned and any
change to the store will trigger a re-render.

#### Parameters

1. `selector` [optional] - `(store: Store) => Partial<Store>`

#### Usage

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
const { quote } = use[Named]Store((store) => ({
  quote: store.quote,
}));

// WITHOUT SELECTOR:
// A re-render will happen any time the following values change:
// store.count, store.quote, store.likes, store.savedItems, or store.purchases.
const { quote } = use[Named]Store();
```

### use[Named]Handlers

This hook returns an object containing all of the handlers
as defined in `useGlaukosHook`. Any sync functions are converted into
async functions which resolves after a zero setTimeout callback runs.
This somewhat mimics vue's [nextTick](https://vuejs.org/api/general.html#nexttick) behavior.
Though I assume when used in concurrent mode the async function might resolve after only a portion of the rendering completes.
_Calling this hook will never trigger a re-render even if the handlers change._

#### Usage

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
// when calling use[Named]Handlers
const { onLike } = use[Named]Handlers()
```

### use[Named]Refs

A hook that returns an object containing all of the refs provided in
`useGlaukosHook`. Accessing this hook will never cause a re-render.

#### Usage

```typescript
// Assume the following handlers type:
type Refs = {
  counterDomRef: React.RefObject<HTMLDivElement>
}

// No matter which refs you access a re-render will never happen
// when calling use[Named]Refs
const { counterDomRef } = use[Named]Refs()
```

### [Named]BridgeProvider

It’s common for UI libraries to include components like modals that
are rendered in a separate tree. As a result React.useContext loses
access to its provider value when used in these separate render trees.
`glaukos` uses the React Context API under the hood which means
`use[Named]Store` will lose access to the `useGlaukosHook`'s return value
unless we “bridge” the context over to the new render tree.

<aside>
💡 Technically, `use[Named]Refs` and `use[Named]Handlers` are accessible without a bridge provider because their references are stored in global state.

</aside>

#### Props

- `renderer` [required] - `(children: JSX.Element) => JSX.Element`: Function to render the component that is responsible for creating a new render tree.

#### Usage

```tsx
<[Named]BridgeProvider
  renderer={(children) => (
    <UiComponentWithNewRenderTree>{children}</UiComponentWithNewRenderTree>
  )}
>
  <ComponentThatCanNowAccessContext />
</[Named]BridgeProvider>
```

# How to test?

Because we define logic in a standard React hook we can do:

**SomeScreen.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom'
import glaukos from '@interbolt/glaukos'

export const useGlaukosHook = () => {
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

const { NamedProvider, useNamedStore, useNamedHandlers, useNamedRefs } = glaukos(useGlaukosHook, { name: 'Named' })

const Screen = () => {
  return (
    <NamedProvider>
      <ScreenUI />
    </NamedProvider>
  )
}

export default Screen
```

**SomeScreen.test.tsx**

```typescript
import { useGlaukosHook } from "./SomeScreen.tsx";

// write your test here with
// https://github.com/testing-library/react-hooks-testing-library
```

Hooks are easy to test but if `useGlaukosHook` is too monolithic to
test on its own, you can always test the hooks that it composes
instead. Whatever makes sense.
