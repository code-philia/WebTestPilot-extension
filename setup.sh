# Update code
echo "Updating code repositories..."
git branch --set-upstream-to=origin/main
git pull --recurse-submodules
git submodule update --init --recursive --remote

# Setup WebTestPilot + BAML
echo "Setting up WebTestPilot..."
cd WebTestPilot/webtestpilot
uv sync
source ./.venv/bin/activate
python3 -V
uv run baml-cli generate

# Setup webview + extension
echo "Setting up VS Code extension..."
cd ../../
yarn install:all
yarn package