param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location -Path $PSScriptRoot

$port = 9222
$windowSize = '1920,1080'
$profileRoot = [System.IO.Path]::GetTempPath()
$profileDir = Join-Path -Path $profileRoot -ChildPath ("chrome-profile-" + [System.Guid]::NewGuid().ToString('N'))
$logPath = Join-Path -Path $profileRoot -ChildPath 'chrome.log'
$errorLogPath = Join-Path -Path $profileRoot -ChildPath 'chrome-error.log'

if (Test-Path -Path $logPath) {
    Remove-Item -Path $logPath -Force
}

if (Test-Path -Path $errorLogPath) {
    Remove-Item -Path $errorLogPath -Force
}

New-Item -ItemType Directory -Path $profileDir -Force | Out-Null

function Get-ChromePath {
    $candidatePaths = @(
        (Join-Path -Path $env:ProgramFiles -ChildPath 'Google\Chrome\Application\chrome.exe'),
        (Join-Path -Path ${env:ProgramFiles(x86)} -ChildPath 'Google\Chrome\Application\chrome.exe'),
        'chrome.exe'
    )

    foreach ($path in $candidatePaths) {
        if ($path -and (Test-Path -Path $path)) {
            return (Resolve-Path -Path $path).Path
        }
    }

    throw 'Chrome executable not found. Install Google Chrome or add it to PATH.'
}

$chromePath = Get-ChromePath

Write-Host 'Updating Chrome instances...'
Get-Process -Name 'chrome' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Starting Chrome in full screen with profile $profileDir..."
$chromeArgs = @(
    "--remote-debugging-port=$port",
    '--remote-debugging-address=0.0.0.0',
    "--user-data-dir=$profileDir",
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-translate',
    '--disable-features=TranslateUI,Translate',
    '--force-device-scale-factor=1',
    '--disable-geolocation',
    '--use-fake-ui-for-media-stream',
    "--window-size=$windowSize",
    '--start-fullscreen',
    '--enable-logging',
    '--v=1'
)

$chromeProcess = Start-Process -FilePath $chromePath -ArgumentList $chromeArgs -PassThru -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath
Write-Host "Chrome PID: $($chromeProcess.Id)"

Write-Host 'Waiting for Chrome DevTools endpoint...'
$endpoint = $null
$pattern = [regex]'ws://[^\s]+'
$timeout = [TimeSpan]::FromSeconds(30)
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

while (-not $endpoint -and $stopwatch.Elapsed -lt $timeout) {
    $combinedContent = ''

    if (Test-Path -Path $logPath) {
        $combinedContent += (Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue)
    }

    if (Test-Path -Path $errorLogPath) {
        $combinedContent += (Get-Content -Path $errorLogPath -Raw -ErrorAction SilentlyContinue)
    }

    if ($combinedContent) {
        $match = $pattern.Match($combinedContent)
        if ($match.Success) {
            $endpoint = $match.Value
            break
        }
    }
    Start-Sleep -Milliseconds 500
}

if ($endpoint) {
    Write-Host "DevTools endpoint: $endpoint"
} else {
    Write-Warning "DevTools endpoint not found within $($timeout.TotalSeconds) seconds. Inspect $logPath for details."
}
