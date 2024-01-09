```
 _   _         _    ______                                                            _            _
| \ | |       | |   | ___ \                                                          | |          | |
|  \| |  ___  | |_  | |_/ /  ___   ___   ___   _ __ ___   _ __ ___    ___  _ __    __| |  ___   __| |
| . ` | / _ \ | __| |    /  / _ \ / __| / _ \ | '_ ` _ \ | '_ ` _ \  / _ \| '_ \  / _` | / _ \ / _` |
| |\  || (_) || |_  | |\ \ |  __/| (__ | (_) || | | | | || | | | | ||  __/| | | || (_| ||  __/| (_| |
\_| \_/ \___/  \__| \_| \_| \___| \___| \___/ |_| |_| |_||_| |_| |_| \___||_| |_| \__,_| \___| \__,_|

```

# **Read this article: [https://interbolt.org/blog/react-use-selector-optimization/](https://interbolt.org/blog/react-use-selector-optimization/) for why context selectors aren't the best approach going forward.**

## Glaukos

`@interbolt/glaukos` allows developers to compose lots of logic within a single React hook while automatically preventing unnecessary re-renders when accessing its return value.

_Warning: This is experimental. Use at your own risk._

## Installation

```bash
# first install peer dependency
yarn add scheduler

# then install glaukos
yarn @interbolt/glaukos
```
