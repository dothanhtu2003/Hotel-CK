param([ValidateSet('start','stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$localDir = Join-Path $workspace '.local'
$dataDir = Join-Path $localDir 'pgdata'
$binDir = if ($env:PG_BIN) { $env:PG_BIN } else { 'C:\Program Files\PostgreSQL\18\bin' }
$port = 55432
if ($Action -eq 'stop') {
  if (Test-Path (Join-Path $dataDir 'postmaster.pid')) { & "$binDir\pg_ctl.exe" -D $dataDir -m fast -w stop }
  exit $LASTEXITCODE
}
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
$passwordPath = Join-Path $localDir 'pg-password.txt'
if (!(Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
  $randomBytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($randomBytes)
  $rng.Dispose()
  $secret = ([BitConverter]::ToString($randomBytes)).Replace('-','').ToLowerInvariant()
  [IO.File]::WriteAllText($passwordPath, $secret)
  & "$binDir\initdb.exe" -D $dataDir -U hotel_local --pwfile=$passwordPath --auth=scram-sha-256 --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
}
if (Test-Path (Join-Path $dataDir 'postmaster.pid')) {
  try {
    $pidContent = (Get-Content (Join-Path $dataDir 'postmaster.pid') -ErrorAction SilentlyContinue)[0].Trim()
    $proc = Get-Process -Id ([int]$pidContent) -ErrorAction SilentlyContinue
    if (!$proc) { Remove-Item (Join-Path $dataDir 'postmaster.pid') -Force -ErrorAction SilentlyContinue }
  } catch {}
}
if (!(Test-Path (Join-Path $dataDir 'postmaster.pid'))) {
  & "$binDir\pg_ctl.exe" -D $dataDir -l (Join-Path $localDir 'postgres.log') -o "-p $port -h 127.0.0.1" -w start
  if ($LASTEXITCODE -ne 0) { throw 'pg_ctl failed' }
}
$secret = [IO.File]::ReadAllText($passwordPath).Trim()
$env:PGPASSWORD = $secret
try {
  foreach ($databaseName in @('hotel_dev','hotel_test')) {
    $exists = & "$binDir\psql.exe" -h 127.0.0.1 -p $port -U hotel_local -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
    if ($LASTEXITCODE -ne 0) { throw 'Database inspection failed' }
    if ($exists -ne '1') {
      & "$binDir\createdb.exe" -h 127.0.0.1 -p $port -U hotel_local $databaseName
      if ($LASTEXITCODE -ne 0) { throw 'createdb failed' }
    }
  }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
$envPath = Join-Path $workspace '.env'
if (!(Test-Path $envPath)) {
  $baseUrl = "postgresql://hotel_local:${secret}@127.0.0.1:${port}"
  [IO.File]::WriteAllText($envPath, "DATABASE_URL=`"$baseUrl/hotel_dev?schema=hotel`"`nDIRECT_URL=`"$baseUrl/hotel_dev?schema=hotel`"`nTEST_DATABASE_URL=`"$baseUrl/hotel_test?schema=hotel`"`nALLOW_DEMO_SEED=`"true`"`n")
}
Write-Output 'Local cluster ready on 127.0.0.1:55432; hotel_dev and hotel_test. Existing .env preserved.'
