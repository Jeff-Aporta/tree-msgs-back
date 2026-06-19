# Secretos GitHub — tree-msgs-back (Cloudflare Worker + Neon BD_TREE_MSGS)
# Uso: .\scripts\setup-github-secrets.ps1

param(
  [string]$Repo = "Jeff-Aporta/tree-msgs-back",
  [string]$SettingsPath = "..\..\..\local.settings.json"
)

$ErrorActionPreference = "Stop"
$settingsFile = Join-Path $PSScriptRoot $SettingsPath | Resolve-Path
$v = (Get-Content $settingsFile -Raw | ConvertFrom-Json).Values

$cf = $env:CLOUDFLARE_API_TOKEN
if (-not $cf) { $cf = $v.CLOUDFLARE_WORKERS_API_TOKEN }
if (-not $cf) {
  Write-Host "Define CLOUDFLARE_API_TOKEN o CLOUDFLARE_WORKERS_API_TOKEN en local.settings.json." -ForegroundColor Yellow
  exit 1
}

$cf | gh secret set CLOUDFLARE_API_TOKEN -R $Repo
$v.FILESTORE_ACCOUNT_ID | gh secret set CLOUDFLARE_ACCOUNT_ID -R $Repo
$v.LAB_JWT_SECRET | gh secret set LAB_JWT_SECRET -R $Repo
$v.NEON_DATABASE_URL | gh secret set NEON_DATABASE_URL -R $Repo
$v.NEON_DATABASE_URL | gh secret set TREE_MSGS_DATABASE_URL -R $Repo

Write-Host "OK — secretos en $Repo"
gh secret list -R $Repo
