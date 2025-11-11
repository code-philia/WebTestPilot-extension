import React, { useEffect, useState } from "react";
import { useVSCode } from "../hooks/useVSCode";
import "../App.css";
import { useLingui } from "@lingui/react/macro";
import { formatDuration, formatMultiline } from "../utilities/formatters";

interface RunnerMessage {
  type?: string;
  command?: string;
  url?: string;
  data?: string; // screenshot base64
  level?: string;
  text?: string;
  displayMessage?: string;
  eventType?: "bug" | "PASSED" | "FAILED";
}

export const SingleRunner: React.FC = () => {
  const { t } = useLingui();
  const { postMessage, onMessage } = useVSCode();

  const [url, setUrl] = useState("-");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStop, setShowStop] = useState(false);
  const [stopDisabled, setStopDisabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusEventType, setStatusEventType] = useState<string | undefined>(undefined);
  const [screenshotVersion, setScreenshotVersion] = useState(0);
  const [pulseStatus, setPulseStatus] = useState(false);
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
            setScreenshotVersion((v) => v + 1);
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
          // start timer
          setStartAt(Date.now());
          setElapsedMs(0);
          setTimerOn(true);
          break;
        case "testFinished":
        case "testStopped":
          // Keep the action button visible but switch it to "Rerun"
          setShowStop(true);
          setStopDisabled(false);
          // stop timer
          setTimerOn(false);
          break;
        case "statusUpdate":
          if (raw.displayMessage) {
            setStatusMessage(raw.displayMessage);
            setStatusEventType(undefined);
          }
          if (raw.eventType) {
            setStatusEventType(raw.eventType);
          }
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

  // Pulse highlight when status updates
  useEffect(() => {
    if (!statusMessage) return;
    setPulseStatus(true);
    const t = setTimeout(() => setPulseStatus(false), 800);
    return () => clearTimeout(t);
  }, [statusMessage]);

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
      <div className="sr-topbar" role="banner">
        <div className="sr-boxes">
          <div className="sr-infobox sr-urlbox" title={url} aria-label={t`Current URL`}> 
            <div className="label">{t`Current URL`}</div>
            <div className="sr-url-text" data-testid="current-url">{formatMultiline(url.length > 40 ? url.slice(0, 60) + "..." : url)}</div>
          </div>
          <div className="sr-infobox" aria-live="polite" aria-label={t`Elapsed`}>
            <div className="label">{t`Elapsed`}</div>
            <div className="sr-step-text" data-testid="elapsed-time">{formatDuration(elapsedMs)}</div>
          </div>
          <div
            className={`sr-infobox step ${
              statusEventType === "PASSED"
                ? "is-passed"
                : statusEventType === "FAILED"
                ? "is-failed"
                : statusEventType === "bug"
                ? "is-bug"
                : ""
            } sr-breathe ${pulseStatus ? "sr-pulse" : ""}`}
            aria-label={t`Step Update`}
            data-status={statusEventType || "none"}
          >
            <div className="label">{t`Step Update`}</div>
            <div className="sr-step-text" data-testid="step-update">{formatMultiline(statusMessage) || t`No updates yet`}</div>
          </div>
        </div>
        <div className="sr-right-controls">
          {showStop && (
            <button
              onClick={timerOn ? handleStop : handleRerun}
              disabled={timerOn ? stopDisabled : false}
              className={timerOn ? "sr-stop-button" : "sr-rerun-button"}
              aria-live="polite"
              aria-busy={timerOn ? stopDisabled : false}
            >
              <span className={timerOn ? "sr-stop-emoji" : "sr-rerun-emoji"} aria-hidden>
                {timerOn ? "⏹️" : "🔁"}
              </span>
              <span>{timerOn ? (stopDisabled ? t`Stopping...` : t`Stop Test`) : t`Rerun Test`}</span>
            </button>
          )}
        </div>
      </div>
      <div className="sr-content">
        {loading && (
          <div className="sr-loading" role="status" aria-live="polite">
            <span className="sr-spinner" />
            {t`Connecting to remote browser...`}
          </div>
        )}
        {screenshot && (
          <img
            id="screenshot"
            src={screenshot}
            alt={t`Live screenshot`}
            className="sr-screenshot"
            key={screenshotVersion}
            data-testid="live-screenshot"
          />
        )}
      </div>
    </div>
  );
};

export default SingleRunner;
