Add-Type -AssemblyName System.IO.Compression.FileSystem

$filePath = "e:\SHP PROJECT BASE DE DATOS\MAESTRO REPORTES BENEFICIO ZA - PRODUCCION Y SEG.xlsm"
$zip = [System.IO.Compression.ZipFile]::OpenRead($filePath)

# Load shared strings
$ssEntry = $zip.GetEntry("xl/sharedStrings.xml")
$sharedStrings = @()
if ($ssEntry) {
    $reader = New-Object System.IO.StreamReader($ssEntry.Open())
    $ssXml = [xml]$reader.ReadToEnd()
    $reader.Close()
    foreach ($si in $ssXml.sst.si) {
        $t = $si.t
        if (-not $t -and $si.r) {
            $t = ($si.r | ForEach-Object { $_.t }) -join ""
        }
        $sharedStrings += $t
    }
}

# Mapping table to worksheet
$wbEntry = $zip.GetEntry("xl/workbook.xml")
$wbXml = [xml](New-Object System.IO.StreamReader($wbEntry.Open())).ReadToEnd()
$relsEntry = $zip.GetEntry("xl/_rels/workbook.xml.rels")
$relsXml = [xml](New-Object System.IO.StreamReader($relsEntry.Open())).ReadToEnd()

$sheetMap = @{}
foreach ($s in $wbXml.workbook.sheets.sheet) {
    $rId = $s.id
    $rel = $relsXml.Relationships.Relationship | Where-Object { $_.Id -eq $rId }
    $sheetMap[$s.name] = $rel.Target
}

# Function to extract cell value
function Get-CellValue($c) {
    if (-not $c) { return $null }
    $v = $c.v
    if ($c.t -eq "s" -and $v -ne $null) {
        $idx = [int]$v
        return $sharedStrings[$idx]
    }
    if ($c.is -and $c.is.t) {
        return $c.is.t
    }
    return $v
}

# Let's extract tblEquipos
# tblEquipos is in "Maestro Equipos" (sheet348 -> xl/worksheets/sheet42.xml or similar)
# Let's find which sheet has table18.xml
$tableEntry = $zip.GetEntry("xl/tables/table18.xml") # tblEquipos
$tblXml = [xml](New-Object System.IO.StreamReader($tableEntry.Open())).ReadToEnd()
$colNames = @($tblXml.table.tableColumns.tableColumn | ForEach-Object { $_.name })
$tableRange = $tblXml.table.ref # e.g. B4:I247

Write-Host "tblEquipos range: $tableRange"

# Find sheet that references table18
$targetSheet = $null
foreach ($entry in ($zip.Entries | Where-Object { $_.FullName -like "xl/worksheets/_rels/*.rels" })) {
    $rXml = [xml](New-Object System.IO.StreamReader($entry.Open())).ReadToEnd()
    foreach ($rel in $rXml.Relationships.Relationship) {
        if ($rel.Target -like "*table18.xml") {
            $sheetRelName = $entry.Name -replace "\.rels$", ""
            $targetSheet = "xl/worksheets/$sheetRelName"
            break
        }
    }
    if ($targetSheet) { break }
}

Write-Host "Target worksheet for tblEquipos: $targetSheet"

$equipos = @()
if ($targetSheet) {
    $wsEntry = $zip.GetEntry($targetSheet)
    $wsXml = [xml](New-Object System.IO.StreamReader($wsEntry.Open())).ReadToEnd()
    
    # Parse range B4:I247 -> Header is row 4, data is row 5 to 247
    # Cols B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9
    $rows = $wsXml.worksheet.sheetData.row | Where-Object { [int]$_.r -ge 5 -and [int]$_.r -le 255 }
    foreach ($row in $rows) {
        $cellDict = @{}
        foreach ($c in $row.c) {
            $colLetter = $c.r -replace "[0-9]", ""
            $cellDict[$colLetter] = Get-CellValue $c
        }
        $codigo = $cellDict["B"]
        if ($codigo) {
            $equipos += [PSCustomObject]@{
                codigo = $codigo
                area = $cellDict["C"]
                descripcion = $cellDict["D"]
                criticidad = $cellDict["E"]
                num_avisos = $cellDict["F"]
                pendientes = $cellDict["G"]
                parado = $cellDict["H"]
                ultimo_aviso = $cellDict["I"]
            }
        }
    }
}

Write-Host "Total Equipos extraídos: $($equipos.Count)"

# Also extract tblCatControles (table11.xml)
# Table: tblCatControles | Cols: Módulo | Ítem | Ubicación / detalle | Unidad | Mín | Máx | Referencia | Activo
$targetSheetControles = $null
foreach ($entry in ($zip.Entries | Where-Object { $_.FullName -like "xl/worksheets/_rels/*.rels" })) {
    $rXml = [xml](New-Object System.IO.StreamReader($entry.Open())).ReadToEnd()
    foreach ($rel in $rXml.Relationships.Relationship) {
        if ($rel.Target -like "*table11.xml") {
            $sheetRelName = $entry.Name -replace "\.rels$", ""
            $targetSheetControles = "xl/worksheets/$sheetRelName"
            break
        }
    }
    if ($targetSheetControles) { break }
}

Write-Host "Target worksheet for tblCatControles: $targetSheetControles"

$catControles = @()
if ($targetSheetControles) {
    $wsEntry = $zip.GetEntry($targetSheetControles)
    $wsXml = [xml](New-Object System.IO.StreamReader($wsEntry.Open())).ReadToEnd()
    
    # Range is B16:I130 -> Header is row 16, data is 17 to 135
    $rows = $wsXml.worksheet.sheetData.row | Where-Object { [int]$_.r -ge 17 -and [int]$_.r -le 150 }
    foreach ($row in $rows) {
        $cellDict = @{}
        foreach ($c in $row.c) {
            $colLetter = $c.r -replace "[0-9]", ""
            $cellDict[$colLetter] = Get-CellValue $c
        }
        $modulo = $cellDict["B"]
        $item = $cellDict["C"]
        if ($modulo -and $item) {
            $catControles += [PSCustomObject]@{
                modulo = $modulo
                item = $item
                ubicacion = $cellDict["D"]
                unidad = $cellDict["E"]
                min = $cellDict["F"]
                max = $cellDict["G"]
                referencia = $cellDict["H"]
                activo = $cellDict["I"]
            }
        }
    }
}
Write-Host "Total Controles extraídos: $($catControles.Count)"

# Output JSON
$result = [PSCustomObject]@{
    equipos = $equipos
    catControles = $catControles
}
$result | ConvertTo-Json -Depth 5 | Out-File -FilePath "e:\SHP PROJECT BASE DE DATOS\seed_catalogs.json" -Encoding utf8

$zip.Dispose()
Write-Host "Archivo seed_catalogs.json generado con éxito."
