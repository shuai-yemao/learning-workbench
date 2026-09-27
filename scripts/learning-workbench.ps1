param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Arguments
)

$pluginRoot = Split-Path -Parent $PSScriptRoot
Push-Location $pluginRoot
try {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  & node (Join-Path $pluginRoot "dist\cli.js") @Arguments
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
