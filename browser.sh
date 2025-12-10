#!/bin/bash

PORT=9222
WINDOW_SIZE="1920,1080"
PROFILE_DIR="/tmp/chrome-profile"
HEADLESS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--headless)
            HEADLESS=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [-h|--headless]"
            exit 1
            ;;
    esac
done

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_CMD="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
else
    CHROME_CMD="google-chrome"
fi

# Create a unique temporary profile directory
PROFILE_DIR=$(mktemp -d /tmp/chrome-profile-XXXX)

# Kill any existing Chrome instance using that port
sudo pkill -f chrome

# Make sure profile dir exists
mkdir -p "$PROFILE_DIR"

# Build Chrome arguments
CHROME_ARGS="
    --remote-debugging-port=${PORT}
    --remote-debugging-address=0.0.0.0
    --user-data-dir=${PROFILE_DIR}
    --no-first-run
    --no-default-browser-check
    --disable-extensions
    --disable-translate
    --disable-features=TranslateUI,Translate
    --force-device-scale-factor=1
    --disable-geolocation
    --use-fake-ui-for-media-stream
    --window-size=${WINDOW_SIZE}
"

if [ "$HEADLESS" = true ]; then
    echo "Starting Chrome in headless mode with profile $PROFILE_DIR..."
    CHROME_ARGS="$CHROME_ARGS --headless=new"
else
    echo "Starting Chrome in full screen with profile $PROFILE_DIR..."
fi

# Start Chrome
"$CHROME_CMD" $CHROME_ARGS > /tmp/chrome.log 2>&1 &

CHROME_PID=$!
echo "Chrome PID: $CHROME_PID"

# Wait for "DevTools listening on" in logs
echo "Waiting for Chrome DevTools endpoint..."
while true; do
    endpoint=$(grep -aoE "ws://[^ ]+" /tmp/chrome.log)
    if [ -n "$endpoint" ]; then
        echo "DevTools endpoint: $endpoint"
        break
    fi
    sleep 0.5
done