### Data setup
Setup testcases in your own project folder.
- Open your project (CTrip, 12306 clone).
- Move the folder `./sample/.webtestpilot` to your project folder.
- Open your project in VSCode/Trae.
- Update your .env file with latest key.

### VSCode

#### Add MCP to VSCode
How to add MCP Server to vscode:
- Ctrl + Shift + P, Search for "MCP: Add server"
- Choose stdio.
- Input command `uvx --refresh --env-file "/path/to/folder/WebTestPilot-extension/.env" --from "git+https://github.com/code-philia/WebTestPilot@parallel#subdirectory=webtestpilot" webtestpilot-mcp`
  - **NOTE:** make sure to modify your --env-file path.
- Input Name: "WebTestPilot".
- Choose Workspace.

**NOTE:** in case vscode can't find uvx:
First, use `which uvx` to get the path and copy it.
```bash
which uvx
> /Users/your-name/.local/bin/uvx
```
Second, create or open file `.vscode/mcp.json`, edit command to match.
```json
{
	"servers": {
		"WebTestPilot": {
			"type": "stdio",
			"command": "/Users/your-name/.local/bin/uvx",   <--------- `which uvx` output here.
			"args": [
				"--refresh",
				"--env-file",
				"/path/to/.../WebTestPilot-extension/.env", <--------- make sure .env file is correct.
				"--from",
				"git+https://github.com/code-philia/WebTestPilot@parallel#subdirectory=webtestpilot",
				"webtestpilot-mcp"
			]
		}
	},
	"inputs": []
}
```

#### Test it out
- Check if MCP tools are available in Copilot, if yes, good to go!. (Add more images)
- Try asking `run a gui test` or `list gui tests`.
- When encounter "Allow" prompt, choose "Always allow tools from WebTestPilot ᕦ(ò_óˇ)ᕤ".

### Trae
```bash
uvx --version
> 0.8.*, 0.9.*, ...

uvx --refresh --env-file "/path/to/folder/WebTestPilot-extension/.env" --from "git+https://github.com/code-philia/WebTestPilot@parallel#subdirectory=webtestpilot" webtestpilot-mcp
```
**NOTE:** modify your --enf-file path.

#### Add MCP Server to Trae
- Go to Trae Settings.
- Click MCP
- Add -> Add Manually
- Input the following json (**NOTE:** Make sure to update .env paths accordingly)
```json
{
  "mcpServers": {
    "WebTestPilot": {
      "command": "uvx",
      "args": [
        "--refresh",
        "--env-file",
        "/path/to/.../Cophi/WebTestPilot-extension/.env",
        "--from",
        "git+https://github.com/code-philia/WebTestPilot@parallel#subdirectory=webtestpilot",
        "webtestpilot-mcp"
      ]
    }
  }
}
```
- Click start button if needed.
- Once started and can see list of tools. Good to go!

#### Test it out
- Choose agent: "Builder with MCP".
- Sample questions:
  - "list out gui tests i have"
  - "run invalid phone number on prod"
