$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Missing backend/.env'
}

foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^\s*(?:#.*)?$') { continue }
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        throw 'Invalid entry in backend/.env (expected NAME=value)'
    }
    $key = $Matches[1]
    $value = $Matches[2].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
}

if ($env:MAIL_ENABLED -ne 'true' -or [string]::IsNullOrWhiteSpace($env:MAIL_USERNAME) -or [string]::IsNullOrWhiteSpace($env:MAIL_PASSWORD)) {
    throw 'Set MAIL_ENABLED=true and nonempty MAIL_USERNAME/MAIL_PASSWORD in backend/.env'
}

Write-Host 'Loaded backend/.env; mail enabled and credentials present. SMTP delivery is not yet verified.'
Push-Location $PSScriptRoot
try {
    & .\mvnw.cmd spring-boot:run
    $runExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $runExitCode
