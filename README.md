# 📊 Debug Graph

A Visual Studio Code extension that visualizes the function calls (code paths) leading up to your breakpoints. Gain insights into the execution flow in your code and troubleshoot efficiently!

## ✨ Features

![Show the call path](./.docs/images/basic_example.gif)

## 🚀 Requirements

This extension is designed to work with **all languages** supported by Visual Studio Code. However, the following languages have been tested for compatibility:

| Language | Debugger | Linux | Windows | Notes |
| --- | --- | --- | --- | --- | 
| Go | golang | ✅ | ❔ | |
| Python | [debugpy](https://marketplace.visualstudio.com/items?itemName=ms-python.debugpy) | ✅ | ✅ | |
| JavaScript | Node | ❔ | ✅ | using node.js runtime |
| TypeScript | pwa-node | ✅ | ✅ | using Deno runtime |
| C++ | GDB | ✅ | ❔ | |
| C | GDB | ✅ | ❔ | |
| Rust | lldb | ✅ | ❔ | |
| C# | - | ❌ | ❌ | Issue on c# side, see [issue #1](https://github.com/K0IN/stacktrace-history/issues/1) |

✅ tested | ❌ not working | ❔ not tested

All test projects can be found in the [test_code](./test_code) directory.

> More testing is planned for additional languages such as C#, C, and Java.

## 🛠️ How to Get Started

1. Set a breakpoint in your code.
2. Click on the `Call Graph` icon in the top bar of your editor (only visible while debugging).
3. Explore the variables and trace the origin of your execution.

## 📥 How to Install

1. Open Visual Studio Code.
2. Go to the Extensions view (square icon in the sidebar).
3. Search for Debug Graph and click Install.

You can also install it directly from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=k0in.debug-graph).

## 💻 Issues and Contributions

For bug reports or feature requests, please visit our [GitHub Repository](https://github.com/K0IN/stacktrace-history).

## 📦 Store Information

- Extension Name: **debug-graph**
- Extension ID: **k0in.debug-graph**
- [View on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=k0in.debug-graph)

## Tech Stack

- TypeScript
- [Vue.js](https://vuejs.org/) (for the frontend)
- [Comlink](https://github.com/GoogleChromeLabs/comlink) (for communication between the frontend and backend)
