# Keep this script ASCII-only so Windows PowerShell 5.1 can parse it without a UTF-8 BOM.
# Suppress line-ending conversion notices while preserving Git's whitespace checks.
& git -c core.safecrlf=false -c core.whitespace=cr-at-eol diff --check
if ($LASTEXITCODE -ne 0) { throw 'Whitespace check failed. Review the Git output above.' }
Write-Host 'Whitespace check passed.'
