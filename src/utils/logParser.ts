export type LogEvent =
    | {
      type: "step";
      step: number;
      action?: string;
      status: "started" | "passed" | "failed";
      error?: string;
      raw?: string;
    }
    | {
      type: "verification";
      step: number;
      expectation?: string;
      status: "verifying" | "verifyPassed" | "verifyFailed";
      error?: string;
      raw?: string;
    }
    | {
      type: "bug";
      message: string;
      raw?: string;
    }
    | {
      type: "newTab";
      targetId: string;
      raw?: string;
    }
    | {
        type: "locating",
        raw: string;
    } 
    | {
        type: "re-identifying",
        raw: string
    }
    | {
        type: "code",
        raw: string
    }
    | {
        type: "abstract",
        raw: string
    }
    | {
        type: "proposing-action",
        raw: string
    }
    | {
      type: "other";
      raw: string;
    };

/**
 * Parse a block of log text and return structured events.
 * Supports:
 * - STEP_N: action description
 * - STEP_N_PASSED
 * - STEP_N_FAILED: error
 * - VERIFYING_STEP_N: expectation
 * - VERIFYING_STEP_N_PASSED
 * - VERIFYING_STEP_N_FAILED: error
 * - Bug reported: message
 */
export function parseLogEvents(text: string): LogEvent[] {
    const events: LogEvent[] = [];
    if (!text) {
        return events;
    }

    // Edge case with multi-lines
    if (text.includes("Proposed code:")) {
        // Split for "Proposed code:" and take the code part
        return [
            { type: "code", raw: text.split("Proposed code:")[1].trim() }
        ];
    }
    if (text.includes("Abstracting page...")) {
        return [
            { type: "abstract", raw: "Abstracting page..." }
        ];
    }

    if (text.includes("Reasoning next action...")) {
        return [
            { type: "proposing-action", raw: "Reasoning next action..." }
        ];
    }

    if (text.includes("Checking page re-identification")) {
        return [
            { type: "re-identifying", raw: "Checking page re-identification" }
        ];
    }

    // Split into lines to handle multiple messages in a single chunk
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
        let m: RegExpMatchArray | null;

        // VERIFYING_STEP go first to avoid confusion with STEP_
        m = line.match(/VERIFYING_STEP_(\d+):\s*(.+)/);
        if (m) {
            events.push({
                type: "verification",
                step: parseInt(m[1], 10),
                expectation: m[2].trim(),
                status: "verifying",
                raw: line,
            });
            continue;
        }

        m = line.match(/VERIFYING_STEP_(\d+)_PASSED/);
        if (m) {
            events.push({
                type: "verification",
                step: parseInt(m[1], 10),
                status: "verifyPassed",
                raw: line,
            });
            continue;
        }

        m = line.match(/VERIFYING_STEP_(\d+)_FAILED:\s*(.+)/);
        if (m) {
            events.push({
                type: "verification",
                step: parseInt(m[1], 10),
                status: "verifyFailed",
                error: m[2].trim(),
                raw: line,
            });
            continue;
        }

        m = line.match(/STEP_(\d+):\s*(.+)/);
        if (m) {
            events.push({
                type: "step",
                step: parseInt(m[1], 10),
                action: m[2].trim(),
                status: "started",
                raw: line,
            });
            continue;
        }

        m = line.match(/STEP_(\d+)_PASSED/);
        if (m) {
            events.push({
                type: "step",
                step: parseInt(m[1], 10),
                status: "passed",
                raw: line,
            });
            continue;
        }

        m = line.match(/STEP_(\d+)_FAILED:\s*(.+)/);
        if (m) {
            events.push({
                type: "step",
                step: parseInt(m[1], 10),
                status: "failed",
                error: m[2].trim(),
                raw: line,
            });
            continue;
        }

        // Locating element to click: "description"
        m = line.match(/Locating element to click:\s*"(.+)"/);
        if (m) {
            events.push({
                type: "locating",
                raw: line,
            });
        }

        m = line.match(/Bug reported:\s*(.+)$/);
        if (m) {
            events.push({ type: "bug", message: m[1].trim(), raw: line });
            continue;
        }

        // NEW_TAB_OPENED: targetId - for popup/new tab handling
        m = line.match(/NEW_TAB_OPENED:\s*(.+)$/);
        if (m) {
            events.push({ type: "newTab", targetId: m[1].trim(), raw: line });
            continue;
        }
    }

    return events;
}
