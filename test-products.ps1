# ==========================
# ASSMA API - Test Produits
# ==========================

# Forcer PowerShell à travailler en UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# Fichier de log horodaté
$logFile = "crud-log-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

# Helper pour écrire dans le log
function Write-Log($label, $data) {
    $entry = @{
        step = $label
        timestamp = (Get-Date).ToString("s")
        data = $data
    }
    $json = $entry | ConvertTo-Json -Depth 10 -Compress
    Add-Content -Path $logFile -Value $json
}

Write-Host "🔑 Connexion utilisateur..."
$loginBody = @"
{
  "email": "newuser@assma.com",
  "password": "mypassword"
}
"@

$response = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:4000/api/auth/login" `
  -Body $loginBody `
  -ContentType "application/json"

$token = $response.token
Write-Host "✅ Token récupéré: $token"
$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}
Write-Log "login" $response

# CREATE
Write-Host "📦 Création produit..."
$createBody = @"
{
  "name": "Produit Test",
  "price": 99.9,
  "description": "Créé par script"
}
"@
$create = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:4000/api/products" `
  -Headers $headers `
  -Body $createBody
$productId = $create.product.id
Write-Host "✅ Produit créé avec ID: $productId"
Write-Log "create" $create

# LIST
Write-Host "📋 Liste des produits..."
$list = Invoke-RestMethod -Method Get `
  -Uri "http://localhost:4000/api/products" `
  -Headers $headers
Write-Log "list" $list

# GET by ID
Write-Host "🔍 Récupération produit par ID..."
$one = Invoke-RestMethod -Method Get `
  -Uri "http://localhost:4000/api/products/$productId" `
  -Headers $headers
Write-Log "get" $one

# UPDATE
Write-Host "✏️ Mise à jour produit..."
$updateBody = @"
{
  "price": 149.5,
  "description": "Mise à jour par script"
}
"@
$upd = Invoke-RestMethod -Method Put `
  -Uri "http://localhost:4000/api/products/$productId" `
  -Headers $headers `
  -Body $updateBody
Write-Log "update" $upd

# DELETE
Write-Host "🗑️ Suppression produit..."
$del = Invoke-RestMethod -Method Delete `
  -Uri "http://localhost:4000/api/products/$productId" `
  -Headers $headers
Write-Log "delete" $del

Write-Host "✅ Test CRUD produits terminé avec succès."
Write-Host "📄 Résultats sauvegardés dans $logFile"
