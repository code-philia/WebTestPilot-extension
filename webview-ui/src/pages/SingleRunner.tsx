import React, { useEffect, useState } from "react";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { useVSCode } from "../hooks/useVSCode";
import "../App.css";
import { useLingui } from "@lingui/react/macro";
import { formatDuration } from "../utilities/formatters";

interface RunnerMessage {
  type?: string;
  command?: string;
  url?: string;
  data?: string; // screenshot base64
  level?: string;
  text?: string;
  // Step tracking fields (unified stepUpdate)
  totalSteps?: number;
  stepNumber?: number;
  stepTitle?: string;
  stepStatus?: "started" | "passed" | "failed";
  currentAction?: string;
  error?: string;
}

export const SingleRunner: React.FC = () => {
  const { t } = useLingui();
  const { postMessage, onMessage } = useVSCode();

  const [url, setUrl] = useState("-");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStop, setShowStop] = useState(false);
  const [stopDisabled, setStopDisabled] = useState(false);
  // Step tracking state
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentStepTitle, setCurrentStepTitle] = useState("");
  const [currentAction, setCurrentAction] = useState("");
  const [stepStatus, setStepStatus] = useState<"running" | "passed" | "failed" | "idle">("idle");
  const [testResult, setTestResult] = useState<"PASSED" | "FAILED" | "STOPPED" | null>(null);
  // timer state (minimal)
  const [startAt, setStartAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerOn, setTimerOn] = useState(false);

  useEffect(() => {
    // tell extension we are ready once
    postMessage("ready");

    const unsubscribe = onMessage((raw: RunnerMessage) => {
      const type = raw.type || raw.command;
      switch (type) {
        case "connected":
          setLoading(false);
          setUrl(raw.url || "about:blank");
          break;
        case "screenshot":
          if (raw.data) {
            setScreenshot(`data:image/png;base64,${raw.data}`);
            setLoading(false);
          }
          break;
        case "navigation":
          if (raw.url) setUrl(raw.url);
          break;
        case "console":
          // eslint-disable-next-line no-console
          console.log("[Browser]", raw.level, raw.text);
          break;
        case "testStarted":
          setShowStop(true);
          setStopDisabled(false);
          // Reset step tracking
          setTotalSteps(raw.totalSteps || 0);
          setCurrentStep(0);
          setCurrentStepTitle("");
          setCurrentAction("");
          setStepStatus("idle");
          setTestResult(null);
          // start timer
          setStartAt(Date.now());
          setElapsedMs(0);
          setTimerOn(true);
          break;
        case "stepUpdate":
          // Handle step number and title (when step starts)
          if (raw.stepNumber !== undefined) {
            setCurrentStep(raw.stepNumber);
          }
          if (raw.stepTitle) {
            setCurrentStepTitle(raw.stepTitle);
          }
          // Handle step status changes
          if (raw.stepStatus === "started") {
            setCurrentAction("");
            setStepStatus("running");
          } else if (raw.stepStatus === "passed") {
            setStepStatus("passed");
          } else if (raw.stepStatus === "failed") {
            setStepStatus("failed");
            if (raw.error) {
              setCurrentAction(`Error: ${raw.error}`);
            }
          }
          // Handle current action updates
          if (raw.currentAction) {
            setCurrentAction(raw.currentAction);
          }
          break;
        case "testFinished":
          // Keep the action button visible but switch it to "Rerun"
          setShowStop(true);
          setStopDisabled(false);
          // stop timer
          setTimerOn(false);
          // Determine test result based on step status or explicit result
          if (stepStatus === "failed") {
            setTestResult("FAILED");
          } else if (currentStep === totalSteps && stepStatus === "passed") {
            setTestResult("PASSED");
          } else if (currentStep === totalSteps) {
            setTestResult("PASSED");
          }
          break;
        case "testStopped":
          setShowStop(true);
          setStopDisabled(false);
          setTimerOn(false);
          setTestResult("STOPPED");
          break;
        case "error":
          setLoading(false);
          // stop timer on error
          setTimerOn(false);
          // allow rerun after an error
          setShowStop(true);
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [onMessage, postMessage]);

  // update elapsed while timer running
  useEffect(() => {
    if (!timerOn || !startAt) return;
    setElapsedMs(Date.now() - startAt); // sync immediately
    const id = setInterval(() => setElapsedMs(Date.now() - startAt), 1000);
    return () => clearInterval(id);
  }, [timerOn, startAt]);

  const handleStop = () => {
    postMessage("stopTest");
    setStopDisabled(true);
  };

  const handleRerun = () => {
    postMessage("rerunTest");
  };


  return (
    <div className="sr-container">
      <div className="sr-topbar-compact" role="banner">
        {/* Step Progress - compact inline */}
        <div className="sr-progress-compact">
          {totalSteps > 0 ? (
            <>
              <span className="sr-step-indicator">
                {totalSteps > 0
                  ? (
                    currentStep > 0
                      ? `${t`Step`} ${currentStep}/${totalSteps}`
                      : `${t`Step`} 0/${totalSteps}`
                  )
                  : `--`}
              </span>
              <div className="sr-step-bar-compact">
                {Array.from({ length: totalSteps }, (_, i) => {
                  const stepNum = i + 1;
                  let dotClass = "sr-dot";
                  if (stepNum < currentStep) dotClass += " done";
                  else if (stepNum === currentStep) {
                    dotClass += stepStatus === "passed" ? " done" : stepStatus === "failed" ? " fail" : " active";
                  }
                  return <div key={stepNum} className={dotClass} />;
                })}
              </div>
            </>
          ) : (
            <span className="sr-step-indicator">--</span>
          )}
        </div>

        {/* Test Result Badge */}
        {testResult && (
          <div className={`sr-result-badge ${testResult.toLowerCase()}`}>
            {testResult === "PASSED" ? "✓ PASSED" : testResult === "FAILED" ? "✗ FAILED" : "■ STOPPED"}
          </div>
        )}

        {/* URL - compact */}
        <div className="sr-url-compact" title={url}>
          {url.length > 50 ? url.slice(0, 50) + "..." : url}
        </div>

        {/* Elapsed - compact */}
        <div className="sr-elapsed-compact">
          {formatDuration(elapsedMs)}
        </div>

        {/* Step Title */}
        <div className={`sr-title-compact ${stepStatus === "passed" ? "done" : stepStatus === "failed" ? "fail" : ""}`}>
          {currentStepTitle || "Waiting..."}
        </div>

        {/* Current Action */}
        <div className="sr-action-compact">
          {currentAction || "--"}
        </div>

        {/* Stop/Rerun button - compact */}
        {showStop && (
          <button
            onClick={timerOn ? handleStop : handleRerun}
            disabled={timerOn ? stopDisabled : false}
            className={`sr-btn-compact ${timerOn ? "stop" : "rerun"}`}
          >
            {timerOn ? (stopDisabled ? "..." : "■") : "↻"}
          </button>
        )}
      </div>

      <div className="sr-content">
        {loading && (
          <div className="sr-loading-compact" role="status" aria-live="polite">
            <VSCodeProgressRing />
            <span>Connecting...</span>
          </div>
        )}
        {screenshot && (
          <img
            id="screenshot"
            src={screenshot}
            alt="Live screenshot"
            className="sr-screenshot"
            data-testid="live-screenshot"
          />
        )}
      </div>
    </div>
  );
};

export default SingleRunner;
