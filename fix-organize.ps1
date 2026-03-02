$f = "d:\Tootega\Source\DASE50\DASE\src\Designers\ORM\Commands\OrganizeTablesCommand.ts"
$content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
$pattern = "    // --- AI Grouping Prompt ---\r?\n.*?    // --- AI Grouping Prompt ---"
$result = [regex]::Replace($content, $pattern, "    // --- AI Grouping Prompt ---", [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($result.Length -ne $content.Length) {
    [System.IO.File]::WriteAllText($f, $result, [System.Text.Encoding]::UTF8)
    Write-Host "Splice done. Removed $($content.Length - $result.Length) chars"
} else {
    Write-Host "No change made - pattern not found"
}
