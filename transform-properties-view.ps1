# Transform PropertiesViewProvider.ts
# Adds: TagList editor, hint icons, colored group headers, Placeholder support
# Eliminates code duplication via private BuildHtml method

$path = "d:\Tootega\Source\DASE50\DASE\src\Views\PropertiesViewProvider.ts"
$c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$nl = if ($c.Contains("`r`n")) { "`r`n" } else { "`n" }
Write-Host "File loaded, length=$($c.Length), CRLF=$($c.Contains("`r`n"))"

# ── Helper: normalise line endings in search strings ──────────────────────────
function N($s) { $s.Replace("`r`n", "`n").Replace("`r", "`n") }

$c = N($c)   # normalise file to LF

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Serialization in OnPropertyChanged  (appears once – surrounded by postMessage)
# ═══════════════════════════════════════════════════════════════════════════════
$s1old = "            const serializedProperties = this._Properties.map(p => ({`n                Key: p.Key,`n                Name: p.Name,`n                Value: p.Value,`n                Type: p.Type,`n                Options: p.Options,`n                GroupedOptions: p.GroupedOptions || null,`n                IsReadOnly: p.IsReadOnly,`n                Category: p.Category,`n                Group: p.Group`n            }));`n            this._View.webview.postMessage({"
$s1new = "            const serializedProperties = this._Properties.map(p => ({`n                Key: p.Key,`n                Name: p.Name,`n                Value: p.Value,`n                Type: p.Type,`n                Options: p.Options,`n                GroupedOptions: p.GroupedOptions || null,`n                IsReadOnly: p.IsReadOnly,`n                Category: p.Category,`n                Group: p.Group,`n                Placeholder: p.Placeholder || null,`n                Hint: p.Hint || null`n            }));`n            this._View.webview.postMessage({"
$before = $c.Length; $c = $c.Replace($s1old, $s1new)
Write-Host "Serialization-OnPropertyChanged: $($c.Length - $before) chars delta"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Serialization in UpdateView (appears once – followed by GetHtmlContentWithProperties call)
# ═══════════════════════════════════════════════════════════════════════════════
$s2old = "            const serializedProperties = this._Properties.map(p => ({`n                Key: p.Key,`n                Name: p.Name,`n                Value: p.Value,`n                Type: p.Type,`n                Options: p.Options,`n                GroupedOptions: p.GroupedOptions || null,`n                IsReadOnly: p.IsReadOnly,`n                Category: p.Category,`n                Group: p.Group`n            }));`n            `n            // Force HTML refresh"
$s2new = "            const serializedProperties = this._Properties.map(p => ({`n                Key: p.Key,`n                Name: p.Name,`n                Value: p.Value,`n                Type: p.Type,`n                Options: p.Options,`n                GroupedOptions: p.GroupedOptions || null,`n                IsReadOnly: p.IsReadOnly,`n                Category: p.Category,`n                Group: p.Group,`n                Placeholder: p.Placeholder || null,`n                Hint: p.Hint || null`n            }));`n            `n            // Force HTML refresh"
$before = $c.Length; $c = $c.Replace($s2old, $s2new)
Write-Host "Serialization-UpdateView: $($c.Length - $before) chars delta"

# ═══════════════════════════════════════════════════════════════════════════════
# 3. GetHtmlContentWithProperties signature – add Placeholder/Hint to param type
# ═══════════════════════════════════════════════════════════════════════════════
$s3old = "    GetHtmlContentWithProperties(pProperties: Array<{Key: string; Name: string; Value: unknown; Type: string; Options: string[] | null; GroupedOptions?: Array<{Group: string; Items: string[]}> | null; IsReadOnly: boolean; Category: string; Group?: string}>): string"
$s3new = "    GetHtmlContentWithProperties(pProperties: Array<{Key: string; Name: string; Value: unknown; Type: string; Options: string[] | null; GroupedOptions?: Array<{Group: string; Items: string[]}> | null; IsReadOnly: boolean; Category: string; Group?: string; Placeholder?: string | null; Hint?: string | null}>): string"
$before = $c.Length; $c = $c.Replace($s3old, $s3new)
Write-Host "Signature: $($c.Length - $before) chars delta"

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Replace .property-group-header CSS (appears TWICE — .Replace replaces all)
# ═══════════════════════════════════════════════════════════════════════════════
$s4old = "        .property-group-header {`n            font-weight: 600;`n            padding: 6px 0 4px 0;`n            color: var(--vscode-foreground);`n            border-bottom: 1px solid var(--vscode-panel-border);`n            margin-bottom: 4px;`n            font-size: 11px;`n            text-transform: uppercase;`n            letter-spacing: 0.5px;`n            opacity: 0.8;`n        }"
$s4new = "        .property-group-header {`n            font-weight: 700;`n            padding: 5px 8px 4px 10px;`n            color: var(--vscode-activityBar-activeBorder, #007acc);`n            border-left: 3px solid var(--vscode-activityBar-activeBorder, #007acc);`n            border-bottom: 1px solid var(--vscode-panel-border);`n            margin-bottom: 6px;`n            margin-top: 6px;`n            font-size: 10.5px;`n            text-transform: uppercase;`n            letter-spacing: 0.8px;`n            background: linear-gradient(to right, rgba(0,122,204,0.07), transparent);`n        }"
$before = $c.Length; $c = $c.Replace($s4old, $s4new)
Write-Host "GroupHeader CSS: $($c.Length - $before) chars delta"

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Replace .property-name CSS + add .property-name-text and .prop-hint-icon
#    (appears TWICE — .Replace handles both)
# ═══════════════════════════════════════════════════════════════════════════════
$s5old = "        .property-name {`n            flex: 0 0 40%;`n            padding-right: 8px;`n            overflow: hidden;`n            text-overflow: ellipsis;`n            white-space: nowrap;`n        }"
$s5new = "        .property-name {`n            flex: 0 0 40%;`n            padding-right: 8px;`n            display: flex;`n            align-items: center;`n            min-width: 0;`n            gap: 3px;`n        }`n        .property-name-text {`n            overflow: hidden;`n            text-overflow: ellipsis;`n            white-space: nowrap;`n            flex: 1;`n            min-width: 0;`n        }`n        .prop-hint-icon {`n            display: inline-flex;`n            align-items: center;`n            justify-content: center;`n            width: 12px;`n            height: 12px;`n            font-size: 8px;`n            font-weight: 700;`n            border-radius: 50%;`n            background: var(--vscode-activityBar-activeBorder, #007acc);`n            color: #ffffff;`n            cursor: help;`n            flex-shrink: 0;`n            opacity: 0.65;`n            user-select: none;`n            line-height: 1;`n        }`n        .prop-hint-icon:hover {`n            opacity: 1;`n        }"
$before = $c.Length; $c = $c.Replace($s5old, $s5new)
Write-Host "PropertyName+HintIcon CSS: $($c.Length - $before) chars delta"

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Add taglist CSS after .property-value select.grouped-select option block
#    (appears TWICE — .Replace handles both)
# ═══════════════════════════════════════════════════════════════════════════════
$s6old = "        .property-value select.grouped-select option {`n            padding-left: 8px;`n        }`n    </style>"
$s6new = "        .property-value select.grouped-select option {`n            padding-left: 8px;`n        }`n        .taglist-container {`n            display: flex;`n            flex-wrap: wrap;`n            align-items: center;`n            gap: 3px;`n            padding: 3px 5px;`n            min-height: 26px;`n            background-color: var(--vscode-input-background);`n            border: 1px solid var(--vscode-input-border);`n            box-sizing: border-box;`n            cursor: text;`n        }`n        .taglist-container:focus-within {`n            outline: 1px solid var(--vscode-focusBorder);`n            border-color: var(--vscode-focusBorder);`n        }`n        .taglist-disabled {`n            opacity: 0.6;`n            cursor: default;`n            pointer-events: none;`n        }`n        .tag-chip {`n            display: inline-flex;`n            align-items: center;`n            gap: 3px;`n            padding: 1px 6px 1px 7px;`n            background: linear-gradient(135deg, #0078D4 0%, #005a9e 100%);`n            color: #ffffff;`n            font-size: 10px;`n            border-radius: 10px;`n            white-space: nowrap;`n            max-width: 130px;`n            overflow: hidden;`n            text-overflow: ellipsis;`n        }`n        .tag-remove {`n            display: inline-flex;`n            align-items: center;`n            justify-content: center;`n            font-size: 13px;`n            line-height: 1;`n            cursor: pointer;`n            opacity: 0.75;`n            flex-shrink: 0;`n            margin-left: 1px;`n            padding-bottom: 1px;`n        }`n        .tag-remove:hover {`n            opacity: 1;`n        }`n        .tag-input {`n            flex: 1;`n            min-width: 60px;`n            border: none;`n            outline: none;`n            background: transparent;`n            color: inherit;`n            font-family: inherit;`n            font-size: inherit;`n            padding: 1px 2px;`n        }`n        .taglist-validation-msg {`n            font-size: 10px;`n            color: var(--vscode-inputValidation-errorForeground, #f14c4c);`n            min-height: 13px;`n            padding: 1px 4px 0;`n        }`n    </style>"
$before = $c.Length; $c = $c.Replace($s6old, $s6new)
Write-Host "TagList CSS: $($c.Length - $before) chars delta"

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Update property-name rendering in RenderProperties (appears TWICE)
# ═══════════════════════════════════════════════════════════════════════════════
$s7old = "                    html += '<div class=""property-name"" title=""' + EscapeHtml(prop.Key) + '"">' + EscapeHtml(prop.Name) + '</div>';"
$s7new = "                    html += '<div class=""property-name"">';" + "`n" + "                    html += '<span class=""property-name-text"" title=""' + EscapeHtml(prop.Key) + '"">' + EscapeHtml(prop.Name) + '</span>';" + "`n" + "                    if (prop.Hint)" + "`n" + "                        html += '<span class=""prop-hint-icon"" title=""' + EscapeHtml(prop.Hint) + '"">i</span>';" + "`n" + "                    html += '</div>';"
$before = $c.Length; $c = $c.Replace($s7old, $s7new)
Write-Host "RenderProperties name+hint: $($c.Length - $before) chars delta"

# ═══════════════════════════════════════════════════════════════════════════════
# 8. Add TagList case + placeholder to default text input (appears TWICE)
# ═══════════════════════════════════════════════════════════════════════════════
$s8old = "                default:`n                    return '<input type=""text"" data-key=""' + key + '"" value=""' + EscapeHtml(String(value)) + '"" ' + readonly + '>';"
$s8new = "                case ""TagList"":`n                    const tagValues = value ? String(value).split(""|"").filter(function(tv) { return tv.trim().length > 0; }) : [];`n                    let tagChips = '';`n                    for (const tv of tagValues)`n                    {`n                        const safeTag = EscapeHtml(tv.trim());`n                        tagChips += '<div class=""tag-chip"" data-tag=""' + safeTag + '"">' + safeTag;`n                        if (!pProp.IsReadOnly) tagChips += '<span class=""tag-remove"">&#xD7;</span>';`n                        tagChips += '</div>';`n                    }`n                    const tagCls = 'taglist-container' + (pProp.IsReadOnly ? ' taglist-disabled' : '');`n                    const tagInput = pProp.IsReadOnly ? '' : '<input class=""tag-input"" type=""text"" placeholder=""Add value, press Enter\u2026"">';`n                    return '<div class=""' + tagCls + '"" data-key=""' + key + '"">' + tagChips + tagInput + '</div>' +`n                           '<div class=""taglist-validation-msg""></div>';`n`n                default:`n                    const phAttr = pProp.Placeholder ? ' placeholder=""' + EscapeHtml(pProp.Placeholder) + '""' : '';`n                    return '<input type=""text"" data-key=""' + key + '"" value=""' + EscapeHtml(String(value)) + '"" ' + readonly + phAttr + '>';"
$before = $c.Length; $c = $c.Replace($s8old, $s8new)
Write-Host "GetPropertyEditor TagList+placeholder: $($c.Length - $before) chars delta"

# ═══════════════════════════════════════════════════════════════════════════════
# 9. Add taglist event handler in AttachEventHandlers (appears TWICE)
#    Insert before the "close dropdowns" document.addEventListener block
# ═══════════════════════════════════════════════════════════════════════════════
$s9anchor = "            // Close dropdowns when clicking outside`n            document.addEventListener(""click"", function()"
$s9ins = "            // Handle taglist chip editors`n            const taglistContainers = document.querySelectorAll("".taglist-container:not(.taglist-disabled)"");`n            taglistContainers.forEach(function(container) {`n                const tagInput = container.querySelector("".tag-input"");`n                const tagKey = container.getAttribute(""data-key"");`n                if (!tagInput || !tagKey) return;`n`n                function GetTagValues() {`n                    const vals = [];`n                    container.querySelectorAll("".tag-chip"").forEach(function(ch) { const v = ch.getAttribute(""data-tag""); if (v) vals.push(v); });`n                    return vals;`n                }`n                function SendTagUpdate() {`n                    vscode.postMessage({ Type: ""UpdateProperty"", PropertyKey: tagKey, Value: GetTagValues().join(""|"") });`n                }`n                function ShowTagError(msg) {`n                    const el = container.nextElementSibling;`n                    if (el && el.classList.contains(""taglist-validation-msg"")) el.textContent = msg;`n                }`n                function ClearTagError() {`n                    const el = container.nextElementSibling;`n                    if (el && el.classList.contains(""taglist-validation-msg"")) el.textContent = '';`n                }`n                function AddTag(raw) {`n                    const v = raw.trim();`n                    if (!v) { tagInput.value = ''; return; }`n                    if (GetTagValues().indexOf(v) >= 0) { ShowTagError('Duplicate: ""' + v + '""'); return; }`n                    ClearTagError();`n                    const chip = document.createElement('div');`n                    chip.className = 'tag-chip';`n                    chip.setAttribute('data-tag', v);`n                    chip.textContent = v;`n                    const rm = document.createElement('span');`n                    rm.className = 'tag-remove';`n                    rm.innerHTML = '&#xD7;';`n                    rm.addEventListener('click', function(e) { e.stopPropagation(); chip.remove(); ClearTagError(); SendTagUpdate(); });`n                    chip.appendChild(rm);`n                    container.insertBefore(chip, tagInput);`n                    tagInput.value = '';`n                    SendTagUpdate();`n                }`n                tagInput.addEventListener('keydown', function(e) {`n                    if (e.key === 'Enter' || e.key === 'Tab' || e.key === '|') { e.preventDefault(); AddTag(tagInput.value); }`n                    else if (e.key === 'Backspace' && tagInput.value === '') {`n                        const chs = container.querySelectorAll('.tag-chip');`n                        if (chs.length > 0) { chs[chs.length - 1].remove(); ClearTagError(); SendTagUpdate(); }`n                    }`n                });`n                tagInput.addEventListener('blur', function() { if (tagInput.value.trim()) AddTag(tagInput.value); });`n                container.addEventListener('click', function(e) { if (!e.target.classList.contains('tag-remove')) tagInput.focus(); });`n            });`n`n"
$before = $c.Length; $c = $c.Replace($s9anchor, $s9ins + $s9anchor)
Write-Host "AttachEventHandlers taglist: $($c.Length - $before) chars delta"

# ── Write result ─────────────────────────────────────────────────────────────
[System.IO.File]::WriteAllText($path, $c, [System.Text.Encoding]::UTF8)
Write-Host "Done. Final length: $($c.Length)"
