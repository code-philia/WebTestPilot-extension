import React, { useEffect, useRef, useState } from "react";
import { useVSCode } from "../hooks/useVSCode";
import "../App.css";
import { useLingui } from "@lingui/react/macro";

export const SingleRunner: React.FC = () => {
  const { t } = useLingui();
  const { postMessage, onMessage } = useVSCode();
  const [status, setStatus] = useState<string>(t`Connecting to browser...`);
  const [url, setUrl] = useState<string>("-");
  const [footerText, setFooterText] = useState<string>(
    t`Waiting for connection...`
  );
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showStop, setShowStop] = useState<boolean>(false);
  const [stopDisabled, setStopDisabled] = useState<boolean>(false);

  useEffect(() => {
    // Notify extension that webview is ready
    postMessage("ready");

    // Subscribe to messages
    const cleanup = onMessage((message: any) => {
      const type = message?.type || message?.command;
      switch (type) {
        case "connected":
          setStatus(t`🟢 Connected`);
          setLoading(false);
          setUrl(message.url || "about:blank");
          setFooterText(t`Streaming live from remote browser`);
          break;
        case "screenshot":
          if (message.data) {
            setScreenshot("data:image/png;base64," + message.data);
            setLoading(false);
          }
          break;
        case "navigation":
          setUrl(message.url || url);
          break;
        case "console":
          // log from browser
          // eslint-disable-next-line no-console
          console.log("[Browser]", message.level, message.text);
          break;
        case "testStarted":
          setShowStop(true);
          setStopDisabled(false);
          setFooterText(t`Test running... Click Stop to cancel`);
          break;
        case "testFinished":
          setShowStop(false);
          setStopDisabled(false);
          setFooterText(t`Test finished`);
          break;
        case "testStopped":
          setShowStop(false);
          setStopDisabled(false);
          setFooterText(t`Test stopped by user`);
          break;
        case "error":
          setLoading(false);
          setFooterText(t`Connection failed`);
          setStatus(t`🔴 Disconnected`);
          // optionally display message
          break;
        default:
          break;
      }
    });

    return cleanup;
  }, [onMessage, postMessage]);

  const handleStop = () => {
    // send stop to extension
    postMessage("stopTest");
    setStopDisabled(true);
  };

  return (
    <div className="live-browser-root">
      <div className="flex items-center p-2 w-full">
        <div>
          <div className="animate-pulse">
            {t`🔴 Live`}
          </div>
          <div className="status">{status}</div>
          <div>{url}</div>
        </div>
        <div className="controls">
          {showStop && (
            <button
              className={`stop-button ${showStop ? "visible" : ""}`}
              onClick={handleStop}
              disabled={stopDisabled}
            >
              ⏹️ {stopDisabled ? t`Stopping...` : t`Stop Test`}
            </button>
          )}
        </div>
      </div>

      <div className="content">
        {loading && (
          <div className="loading">
            {t`Connecting to remote browser...`}
          </div>
        )}
        {screenshot && (
          <img
            id="screenshot"
            src={screenshot}
            alt={t`Live screenshot`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SingleRunner;
