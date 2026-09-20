Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json
$releaseDirectory = Join-Path $projectRoot "src-tauri\target\release"
$executable = Join-Path $releaseDirectory "gitrune.exe"
$artifactsDirectory = Join-Path $projectRoot "artifacts"
$packageName = "Gitrune-$($package.version)-windows-x64-portable"
$stagingRoot = Join-Path $artifactsDirectory ".portable-stage-$([System.Guid]::NewGuid().ToString('N'))"
$stagingDirectory = Join-Path $stagingRoot $packageName
$archive = Join-Path $artifactsDirectory "$packageName.zip"

function Get-Sha256([string]$Path) {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            return -join ($sha256.ComputeHash($stream) | ForEach-Object { $_.ToString("x2") })
        }
        finally {
            $sha256.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "Release executable was not found at $executable. Run 'npm run tauri -- build' first."
}

$resolvedProjectRoot = [System.IO.Path]::GetFullPath($projectRoot)
$resolvedStagingRoot = [System.IO.Path]::GetFullPath($stagingRoot)
$resolvedStaging = [System.IO.Path]::GetFullPath($stagingDirectory)
if (-not $resolvedStagingRoot.StartsWith($resolvedProjectRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    -not $resolvedStaging.StartsWith($resolvedStagingRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Portable staging path escaped the project directory."
}

New-Item -ItemType Directory -Force -Path $artifactsDirectory | Out-Null
try {
    New-Item -ItemType Directory -Path $stagingDirectory | Out-Null
    Copy-Item -LiteralPath $executable -Destination (Join-Path $stagingDirectory "Gitrune.exe")
    Copy-Item -LiteralPath (Join-Path $projectRoot "docs\PORTABLE.md") -Destination (Join-Path $stagingDirectory "README.md")
    Copy-Item -LiteralPath (Join-Path $projectRoot "LICENSE") -Destination $stagingDirectory
    Copy-Item -LiteralPath (Join-Path $projectRoot "NOTICE") -Destination $stagingDirectory
    Copy-Item -LiteralPath (Join-Path $projectRoot "THIRD_PARTY_NOTICES.md") -Destination $stagingDirectory
    $licenseDirectory = Join-Path $stagingDirectory "LICENSES"
    New-Item -ItemType Directory -Path $licenseDirectory | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot "docs\branding\kit\licenses\Inter-OFL.txt") -Destination (Join-Path $licenseDirectory "Inter-OFL-1.1.txt")

    $sourceCommit = (& git -C $projectRoot rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -ne 0) { $sourceCommit = "unknown" }
    $sourceDirty = [bool](& git -C $projectRoot status --porcelain 2>$null)
    $manifest = [ordered]@{
        schemaVersion = 1
        product = "Gitrune"
        version = $package.version
        target = "windows-x64"
        sourceCommit = $sourceCommit.Trim()
        sourceDirty = $sourceDirty
        executable = [ordered]@{
            file = "Gitrune.exe"
            sha256 = Get-Sha256 -Path $executable
        }
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $stagingDirectory "release-manifest.json") -Encoding utf8
    if (Test-Path -LiteralPath $archive) {
        Remove-Item -LiteralPath $archive -Force
    }
    Compress-Archive -LiteralPath $stagingDirectory -DestinationPath $archive -CompressionLevel Optimal
}
finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}
$hashFile = "$archive.sha256"
$hash = Get-Sha256 -Path $archive
Set-Content -LiteralPath $hashFile -Value "$hash  $([System.IO.Path]::GetFileName($archive))" -Encoding ascii
Write-Output $archive
Write-Output $hashFile
