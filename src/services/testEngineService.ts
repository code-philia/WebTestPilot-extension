import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { TestItem } from "../models";
import { WorkspaceRootService } from "./workspaceRootService.js";

export class TestEngineService {
    private _process: ChildProcess | undefined;
    private TEST_ENGINE_PATH: string;

    get process() {
        return this._process;
    }

    constructor() {
        const workspaceRoot = WorkspaceRootService.getWorkspaceRoot();
        this.TEST_ENGINE_PATH = path.join(
            workspaceRoot,
            "WebTestPilot",
            "webtestpilot"
        );
    }

    get isRunning() {
        return !!this._process && !this._process.killed;
    }

    public async spawnPythonAgent(
        testItem: TestItem,
        outputChannel: vscode.OutputChannel,
        extraArgs: string[] = []
    ): Promise<ChildProcess> {
    // Fixture file path
        const fixtureDataProvider = (global as any).webTestPilotFixtureTreeDataProvider as any;
        let fixtureFilePath: string | undefined;
        if (testItem.fixtureId) {
            const fixture = fixtureDataProvider?.getFixtureWithId(testItem.fixtureId);
            fixtureFilePath = fixture?.fullPath;
        }

        // Environment file path
        const environmentService = (global as any).environmentService as any;
        const selectedEnv = environmentService?.getSelectedEnvironment?.();
        const environmentFilePath = selectedEnv?.fullPath;

        const pythonPath = path.join(
            this.TEST_ENGINE_PATH,
            ".venv",
            "bin",
            "python"
        );
        const cliScriptPath = path.join(
            this.TEST_ENGINE_PATH,
            "src",
            "cli.py"
        );
        const configPath = path.join(
            this.TEST_ENGINE_PATH,
            "src",
            "config.yaml"
        );

        outputChannel.appendLine(`Test Path: ${this.TEST_ENGINE_PATH}`);
        outputChannel.appendLine(`Python: ${pythonPath}`);
        outputChannel.appendLine(`CLI Script: ${cliScriptPath}`);
        outputChannel.appendLine(`Config: ${configPath}`);
        outputChannel.appendLine("");

        // Verify the CLI exists
        try {
            await fs.access(cliScriptPath);
            outputChannel.appendLine("✓ CLI script found");
        } catch (err) {
            outputChannel.appendLine(`✗ CLI script NOT FOUND: ${cliScriptPath}`);
            throw new Error(`CLI script not found: ${cliScriptPath}`);
        }

        // Build base args for the CLI
        const cdpEndpoint = vscode.workspace
            .getConfiguration('webtestpilot')
            .get<string>('cdpEndpoint') || 'http://localhost:9222';

        const args: string[] = [
            cliScriptPath,
            testItem.fullPath,
            "--config",
            configPath,
            "--cdp-endpoint",
            cdpEndpoint,
        ];

        if (fixtureFilePath) {
            args.push("--fixture-file-path", fixtureFilePath);
        }
        if (environmentFilePath) {
            args.push("--environment-file-path", environmentFilePath);
        }

        // Add extra args if provided (e.g., target-id for parallel tabs)
        if (extraArgs && extraArgs.length > 0) {
            args.push(...extraArgs);
        }

        outputChannel.appendLine("Executing Python agent...");
        outputChannel.appendLine("");

        const child = spawn(pythonPath, args, {
            env: {
                ...process.env,
                BAML_LOG: "info",
            },
        });

        this._process = child;

        return child;
    }

    public stop() {
        if (this._process && !this._process.killed) {
            try {
                this._process.kill("SIGTERM");
            } catch (_) {
                // swallow
            }
            // Force kill shortly after if it didn't die
            setTimeout(() => {
                if (this._process && !this._process.killed) {
                    try {
                        this._process.kill("SIGKILL");
                    } catch (_) {
                        // swallow
                    }
                }
            }, 2000);
        }
    }
}
