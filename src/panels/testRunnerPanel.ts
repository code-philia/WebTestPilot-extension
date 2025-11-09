import assert from "assert";
import { Browser, BrowserContext, CDPSession, chromium, Page } from "playwright-core";

import * as vscode from "vscode";
import { TestItem } from "../models";
import { TestEngineService } from "../services/testEngineService";
import { parseLogEvents } from "../utils/logParser";
import { loadWebviewHtml } from "../utils/webviewLoader";

/**
 * TestRunnerPanel handles running tests by connecting to a remote browser via CDP
 * and streaming live screenshots to show test execution in real-time
 */
export class TestRunnerPanel {
    public static currentPanel: TestRunnerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _browser: Browser | undefined;
    private _context: BrowserContext | undefined;
    private _page: Page | undefined;
    private _cdpSession: CDPSession | undefined;
    private _targetId: string | undefined;
    private _testEngine: TestEngineService | undefined;
    private _progress:
    | vscode.Progress<{
        message?: string;
        increment?: number;
      }>
    | undefined = undefined;

    private constructor(
        panel: vscode.WebviewPanel,
    ) {
        this._panel = panel;
        this._panel.webview.html = this._getHtmlForWebview();

        // Connect to CDP and start streaming
        const cdpEndpoint = vscode.workspace
            .getConfiguration("webtestpilot")
            .get<string>("cdpEndpoint") || "http://localhost:9222";
        this._connectToBrowser(cdpEndpoint);

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview (support both `type` and `command` fields)
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                const msgType = message?.type || message?.command;
                switch (msgType) {
                case "ready":
                    return;
                case "stopTest":
                    this._stopTest();
                    return;
                }
            },
            undefined,
            this._disposables
        );
    }

    /**
     * Connects to the remote browser via CDP and starts screenshot streaming
     */
    private async _connectToBrowser(cdpEndpoint: string) {
        try {
            // Connect to CDP
            this._browser = await chromium.connectOverCDP(cdpEndpoint);

            // Close all existing contexts to ensure a fresh isolated context
            // for (const ctx of this._browser.contexts()) {
            //     try {
            //         await ctx.close();
            //     } catch (err) {
            //         console.error("Failed to close context:", err);
            //     }
            // }

            // Always create a new context
            const contexts = this._browser.contexts();
            this._context = contexts.length > 0 ? contexts[0] : await this._browser.newContext({
                viewport: { width: 1920, height: 1080 },
                deviceScaleFactor: 1
            });
            this._context.setDefaultNavigationTimeout(60000);
            this._context.setDefaultTimeout(30000);

            // Close existing pages
            if (this._context) {
                this._context.pages().forEach(async (page: Page) => {
                    if (!page.isClosed()) {
                        await page.close();
                    }
                });
            }
            
            // Always create a new page for each test run
            this._page = await this._context.newPage();
            
            assert(this._page, "Failed to create a new page in the browser");
            
            // Get target ID for the new page
            const cdp = await this._page.context().newCDPSession(this._page);
            const { targetInfo } = await cdp.send('Target.getTargetInfo');
            this._targetId = targetInfo.targetId;

            // Send initial info
            this._panel.webview.postMessage({
                type: "connected",
                url: this._page.url(),
            });

            // Listen to console messages from the browser
            this._page.on("console", (msg: any) => {
                this._panel.webview.postMessage({
                    type: "console",
                    level: msg.type(),
                    text: msg.text(),
                });
            });

            // Changes to url, reflect in webview
            this._page.on("framenavigated", (frame: any) => {
                assert(this._page, "Page should be defined");

                if (frame === this._page.mainFrame()) {
                    this._panel.webview.postMessage({
                        type: "navigation",
                        url: frame.url(),
                    });
                }
            });

            await this._startWebcastStream();
        } catch (error) {
            console.error("Failed to connect to browser:", error);
            vscode.window.showErrorMessage(
                `Failed to connect to CDP at ${cdpEndpoint}. Make sure Chrome is running with --remote-debugging-port=9222`
            );
            this._panel.webview.postMessage({
                type: "error",
                message: `Connection failed: ${error}`,
            });
        }
    }

    /**
    * Stops the currently running Python test process
    */
    private _stopTest() {
        assert(this._testEngine, "Test engine should be defined");
        if (this._testEngine.isRunning) {
            console.log("Stopping Python test process...");

            if (this._testEngine) {
                this._testEngine.stop();
            }

            // Update UI
            this._panel.webview.postMessage({
                type: "testStopped",
            });

            vscode.window.showWarningMessage("Test execution stopped by user");
        }
    }

    /**
    * Starts periodic screenshot capture and streaming to webview
    */
    private async _startWebcastStream() {
        assert(this._context, "Browser context should be defined");
        assert(this._page, "Page should be defined");
        
        const client = await this._context.newCDPSession(this._page);
        this._cdpSession = client;

        await client.send('Page.startScreencast', {
            format: 'jpeg',
            quality: 60,
            maxWidth: 1920,
            maxHeight: 1080,
            everyNthFrame: 2
        });
    
        client.on('Page.screencastFrame', async (frame) => {
            const { data, sessionId } = frame;
            this._panel.webview.postMessage({
                type: 'screenshot',
                data,
            });
            await client.send('Page.screencastFrameAck', { sessionId });
        });
    }

    /**
    * Opens a test in a live browser viewer with CDP connection and runs the Python agent
    * @param testItem The test to run
    * @param workspaceRoot The workspace root path
    */
    public static async createOrShow(
        testItem: TestItem,
    ) {
        try {
            const url = testItem.url;

            // Validate test has actions
            console.log(testItem);
            if (!testItem.actions || testItem.actions.length === 0) {
                vscode.window.showWarningMessage(
                    `Test "${testItem.name}" has no actions defined. Please add test actions before running.`
                );
                return;
            }

            // If we already have a panel, dispose it and create a new one
            if (TestRunnerPanel.currentPanel) {
                TestRunnerPanel.currentPanel.dispose();
            }

            // Create a new panel for live browser view
            const panel = vscode.window.createWebviewPanel(
                "Single Runner",
                `Single Runner: ${testItem.name}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                }
            );

            TestRunnerPanel.currentPanel = new TestRunnerPanel(
                panel
            );

            // Wait for browser connection to be established and targetId to be available
            await TestRunnerPanel.currentPanel._waitForTargetId();

            // Run the test using the instance method
            await TestRunnerPanel.currentPanel._runTest(testItem);

            console.log("Test execution completed:", {
                testName: testItem.name,
                url: url,
                actionsCount: testItem.actions?.length || 0,
            });
        } catch (error) {
            console.error("Error running test:", error);
            vscode.window.showErrorMessage(`Failed to run test: ${error}`);
        }
    }

    /**
     * Wait for targetId to be available after browser connection
     */
    private async _waitForTargetId(): Promise<void> {
        const maxWaitTime = 30000; // 10 seconds
        const checkInterval = 1000; // 100ms
        let elapsed = 0;

        while (!this._targetId && elapsed < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            elapsed += checkInterval;
        }

        if (!this._targetId) {
            throw new Error("Failed to establish browser connection and get target ID");
        }
    }

    /**
     * Internal method to run the test using the instance's targetId
     */
    private async _runTest(testItem: TestItem): Promise<void> {
        // Create output channel for test execution logs
        const outputChannel = vscode.window.createOutputChannel(
            "WebTestPilot Test Runner"
        );
        outputChannel.clear();
        outputChannel.show(true);

        // Show progress notification with cancel button
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Running test: ${testItem.name}`,
                cancellable: true,
            },
            async (progress, token) => {
                this._progress = progress;

                // Handle cancellation from notification
                token.onCancellationRequested(() => {
                    console.log("Test cancelled from notification");
                    this._stopTest();
                });

                const testEngine = new TestEngineService();
                this._testEngine = testEngine;

                try {
                    const pythonProcess = await testEngine.spawnPythonAgent(
                        testItem,
                        outputChannel,
                        this._targetId!
                    );

                    // Update webview to show stop button
                    this._panel.webview.postMessage({
                        type: "testStarted",
                    });

                    let stdoutData = "";
                    let stderrData = "";

                    assert(!!pythonProcess.stdout && !!pythonProcess.stderr);

                    pythonProcess.stdout.on("data", (data: Buffer) => {
                        const text = data.toString();
                        stdoutData += text;
                        outputChannel.append(text);

                        // Parse step information from logs
                        this._parseStepUpdates(text);
                    });

                    pythonProcess.stderr.on("data", (data: Buffer) => {
                        const text = data.toString();
                        stderrData += text;
                        outputChannel.append(`STDERR: ${text}`);

                        this._parseStepUpdates(text);
                    });

                    await new Promise<void>((resolve, reject) => {
                        pythonProcess.on("close", (code: number, signal: string) => {
                            // Update webview
                            this._panel.webview.postMessage({
                                type: "testFinished",
                            });

                            outputChannel.appendLine("");
                            outputChannel.appendLine("=".repeat(60));

                            // Check if process was terminated by signal (user stopped it)
                            if (signal === "SIGTERM" || signal === "SIGKILL") {
                                outputChannel.appendLine(
                                    "⚠️  Test execution stopped by user"
                                );
                                outputChannel.appendLine("=".repeat(60));
                                resolve();
                                return;
                            }

                            if (code === 0) {
                                outputChannel.appendLine(
                                    "✅ Test execution completed successfully!"
                                );

                                vscode.window
                                    .showInformationMessage(
                                        `✅ Test "${testItem.name}" PASSED - All steps completed successfully!`,
                                        "View Output"
                                    )
                                    .then((selection) => {
                                        if (selection === "View Output") {
                                            outputChannel.show();
                                        }
                                    });

                                this._panel.webview.postMessage({
                                    type: "statusUpdate",
                                    eventType: "PASSED",
                                });

                                resolve();
                            } else {
                                outputChannel.appendLine(
                                    `❌ Test execution failed with exit code: ${code}`
                                );
                                vscode.window
                                    .showErrorMessage(
                                        `❌ Test "${testItem.name}" FAILED - Check output for details.`,
                                        "View Output"
                                    )
                                    .then((selection) => {
                                        if (selection === "View Output") {
                                            outputChannel.show();
                                        }
                                    });

                                this._panel.webview.postMessage({
                                    type: "statusUpdate",
                                    eventType: "FAILED"
                                });
                                reject(new Error(`Python process exited with code ${code}`));
                            }

                            outputChannel.appendLine("=".repeat(60));
                        });

                        pythonProcess.on("error", (error: Error) => {
                            outputChannel.appendLine("");
                            outputChannel.appendLine(
                                `❌ Failed to start Python process: ${error.message}`
                            );
                            reject(error);
                        });
                    });
                } catch (error) {
                    outputChannel.appendLine("");
                    outputChannel.appendLine(`❌ Error: ${error}`);
                    throw error;
                }
            }
        );
    }

    /**
    * Gets the HTML content for the webview
    */
    private _getHtmlForWebview(): string {
        return loadWebviewHtml(
            this._panel.webview,
            "singleRunner"
        );
    }

    /**
    * Parse step updates from Python process output
    */
    private _parseStepUpdates(text: string) {
        assert(this._progress, "Progress object should be defined");

        const events = parseLogEvents(text);
        for (const ev of events) {
            let message = "";
            let eventType = "";

            if (ev.type === "step") {
                const stepNumber = ev.step;
                if (ev.status === "started") {
                    message = `Step ${stepNumber}: ${ev.action || ""}`;
                } else if (ev.status === "passed") {
                    message = `Step ${stepNumber}: ✓ Passed`;
                } else if (ev.status === "failed") {
                    message = `Step ${stepNumber}: ❌ Failed - ${ev.error || "error"}`;
                }
            } else if (ev.type === "verification") {
                const stepNumber = ev.step;

                if (ev.status === "verifying") {
                    message = `Step ${stepNumber}: Verifying - ${ev.expectation || ""}`;
                } else if (ev.status === "verifyPassed") {
                    message = `Step ${stepNumber}: ✓ Completed Verification`;
                    vscode.window.showInformationMessage(message);
                } else if (ev.status === "verifyFailed") {
                    message = `Step ${stepNumber}: ❌ Failed - ${
                        ev.error || "verification failed"
                    }`;
                }
            } else if (ev.type === "bug") {
                message = `Bug reported: ${ev.message}`;
                eventType = "bug";
                vscode.window.showErrorMessage(message);
            } else if (ev.type === "locating" || ev.type === "abstract") {
                message = ev.raw;
            } else if (ev.type === "re-identifying") {
                message = "Checking page re-identification...";
            } else if (ev.type === "code") {
                message = `Executing proposed code, ${ev.raw}`;
            } else if (ev.type === "proposing-action") {
                message = "Reasoning next action...";
            }

            if (message !== "") {
                console.log(message);
                this._progress.report({
                    message: message,
                });
                this._panel.webview.postMessage({
                    type: "statusUpdate",
                    displayMessage: message,
                    eventType,
                });
            }
        }
    }

    /**
    * Disposes the panel and cleans up resources
    */
    public dispose() {
        TestRunnerPanel.currentPanel = undefined;

        // Clear progress reference
        this._progress = undefined;

        // Stop any running test
        if (this._testEngine?.isRunning) {
            console.log("Stopping Python process on dispose");
            this._testEngine.stop();
        }

        // Stop screenshot streaming
        if (this._cdpSession) {
            this._cdpSession.send('Page.stopScreencast');
        }

        // Close browser connection
        if (this._browser) {
            this._browser.close().catch((err: Error) => {
                console.error("Error closing browser:", err);
            });
        }

        // Clean up panel
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}