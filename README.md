# WebTestPilot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen)](https://nodejs.org/)

An AI-powered VS Code extension for automated web testing and test case generation.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#setup)
- [Usage](#usage)

## Clone repo
```bash
git clone --recurse-submodules https://github.com/code-philia/WebTestPilot-extension.git
```

Note: In case you cloned it normally, run the following to update:
```bash

## Prerequisites

- [Google Chrome](https://www.google.com/chrome/) installed locally
- Node.js >= 22.9.0
- Python 3.12

## Setup

#### Install uv
Install uv using the following scripts:
```bash
# For MacOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# For Windows
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Test the command
uv
```

For more details, refer to [original uv document](https://docs.astral.sh/uv/getting-started/installation/#__tabbed_1_1).

#### Setup Extension
```bash
# If don't have yarn
npm install --global yarn

# MacOS / Linux / WSL
source setup.sh

# Windows
powershell -ExecutionPolicy Bypass -File setup.ps1
```

## Usage
#### Start the Development Server
1. Start chrome browser instance: 
``` bash
# MacOS / Linux / WSL
source browser.sh

# Windows
powershell -ExecutionPolicy Bypass -File browser.ps1
```
2. Open file `src/extension.ts`.
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and search for command: "Debug: Start Debugging", click it and choose "VS Code Extension Development".
![start-debugging](./docs/assets/start-debugging.png)
![choose-debugger-type](./docs/assets/choose-debugger-type.png)

#### Open the Testcase Folder
1. In the extension debug window (with the title of "[Extention Development Host]"), open the sample folder inside the WebTestPilot-extension folder.
2. Press `Ctrl+Shift+P` and type "WebTestPilot: Set Workspace...", then select the WebTestPilot-extension folder.
![set-workspace](./docs/assets/set-workspace.png)
![choose-workspace](./docs/assets/choose-workspace.png)

#### Run and Add Testcase
1. Click the WebTestPilot extension icon in the sidebar.
![extension-icon](./docs/assets/extension-icon.png)
2. Click "Run test" to run single test.
![extension-icon](./docs/assets/run-test.png)
3. Write your own testcases in json format in the `sample` folder.


### In case of updates
When there are updates to the code base, run the following command and then restart the extension.

First, update build
```bash
# MacOS / Linux / WSL
source setup.sh

# Windows
sh setup.sh
```

Second, restart the extension. Click the restart button here (after debugging started)
![restart-extension](./docs/assets/restart-extension.png)

or, stop the debugger and start again
![stop-extension](./docs/assets/stop-extension.png)

![start-debugging](./docs/assets/start-debugging.png)
