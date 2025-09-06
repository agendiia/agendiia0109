<#
Run this from PowerShell to build functions, start the Firebase emulators (functions + firestore),
wait until the local callable is available, call `debugSendDailyReminders` with execute=false
(and save the dry-run report to scripts\debug_reminders_result.json).

Usage:
  Open PowerShell as normal (if ExecutionPolicy blocks scripts, run: `powershell -ExecutionPolicy Bypass -File .\scripts\run_debug_emulator.ps1`)
  Or run with params:
    .\scripts\run_debug_emulator.ps1 -Project timevee-53a3c -FunctionName debugSendDailyReminders

Notes:
 - This expects `firebase` CLI to be on PATH (you used it earlier in this workspace).
 - If `functions/node_modules` is missing, the script runs `npm install` inside functions.
 - The emulators are started via Start-Process; the terminal running this script will continue and
   the emulator process runs independently (you can inspect logs in the emulator window).
#>
param(
  [string]$Project = "timevee-53a3c",
  [string]$FunctionName = "debugSendDailyReminders",
  [int]$Port = 5001,
  [int]$MaxAttempts = 60,
  [int]$DelaySec = 3
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

Write-Host "Repository root: $repoRoot"

# Build functions (install deps if missing)
Write-Host 'Checking functions dependencies...'
$functionsDir = Join-Path $repoRoot 'functions'
$nodeModulesPath = Join-Path $functionsDir 'node_modules'
if (-not (Test-Path $nodeModulesPath)) {
  Write-Host 'node_modules not found in functions — running npm install (this may take a while)'
  npm --prefix $functionsDir install
}

Write-Host "Building functions (tsc)..."
npm --prefix "$repoRoot\functions" run build

# Start emulators in background
Write-Host "Starting Firebase emulators (functions + firestore) for project: $Project"
# Use cmd.exe /c to invoke the firebase shim reliably on Windows
$emuCommand = "firebase emulators:start --only functions,firestore --project $Project"
$startInfo = Start-Process -FilePath 'cmd.exe' -ArgumentList "/c $emuCommand" -WorkingDirectory $repoRoot -NoNewWindow -PassThru
Write-Host "Started emulator process Id: $($startInfo.Id)"

# Prepare local callable URL
$url = "http://localhost:$Port/$Project/us-central1/$FunctionName"
Write-Host "Waiting for callable to become available at: $url"

$payload = @{ data = @{ execute = $false } }
$outFile = Join-Path $scriptDir "debug_reminders_result.json"

$success = $false
for ($i = 1; $i -le $MaxAttempts; $i++) {
  try {
  Write-Host "Attempt ${i}: calling $url"
    $jsonBody = $payload | ConvertTo-Json -Depth 10
    $resp = Invoke-RestMethod -Uri $url -Method Post -Body $jsonBody -ContentType 'application/json' -TimeoutSec 120
    Write-Host "Callable responded (HTTP OK). Saving output to $outFile"
    $resp | ConvertTo-Json -Depth 10 | Out-File $outFile -Encoding utf8
    Write-Host "Saved: $outFile"
    $success = $true
    break
  } catch {
    $msg = $_.Exception.Message -replace "\r|\n"," "
    Write-Host "Attempt ${i}: not ready yet. Error: $msg"
    Start-Sleep -Seconds $DelaySec
  }
}

if (-not $success) {
  Write-Host "Failed to call the callable after $MaxAttempts attempts. Check emulator logs in the Firebase emulator window."
  Write-Host "If you prefer, stop the emulator and run: firebase emulators:start --only functions,firestore --project $Project"
  exit 2
}

Write-Host "Dry-run finished. Review $outFile for details."
Write-Host "When done, stop the emulator process (example): Stop-Process -Id $($startInfo.Id)"
