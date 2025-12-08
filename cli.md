## WebTestPilot CLI Setup

### Steps
0. Open your project in VSCode or Trae.
1. Download the .webtestpilot folder and put it in your project.
2. Make sure .env file in project folder have keys for OPENAI_QQ_API_KEY= and BAML_LOG=warn.
3. Install CLI tool and try it.

```bash
# Start the browser
powershell -ExecutionPolicy Bypass -File browser.ps1

# (Optional) if have not installed Playwright before
npx install playwright

uv tool install ieee-gui
gui-test --help
gui-test /ctrip/manage-addresses --env production
gui-test 2.1.1 --env production
```

### Test on your own sites
To test on local:
First, check the values in environment `.webtestpilot/.environment/local.json`, make sure it points to the right localhost in your machine. Then run the CLI.

```bash
gui-test /ctrip/manage-addresses --env local
```

### Upgrades
In case of upgrades:
```bash
uv tool upgrade ieee-gui
```