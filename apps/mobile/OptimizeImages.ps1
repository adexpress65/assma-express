# Script d'automatisation pour A2Express - Optimisation des Images
$projectRoot = "."
$files = Get-ChildItem -Path $projectRoot -Recurse -Include "*.tsx","*.jsx" -Exclude "node_modules","dist",".expo"

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $modified = $false

    # 1. Vérifier si Image de react-native est utilisé
    if ($content -match "import {[^}]*Image[^}]*} from ['""]react-native['""]") {
        
        # Remplacer l'import Image par expo-image si ce n'est pas déjà fait
        if ($content -notmatch "from ['""]expo-image['""]") {
            # On retire Image de react-native (en gardant les autres imports comme View, Text, etc.)
            $content = $content -replace "(import \{[^}]*)(Image,?\s*)([^}]*\} from ['""]react-native['""])", '$1$3'
            $content = $content -replace "(import \{[^}]*,\s*)(Image)([^}]*\} from ['""]react-native['""])", '$1$3'
            
            # On ajoute l'import expo-image au début
            $importLine = "import { Image } from 'expo-image';`n"
            $content = $importLine + $content
            $modified = $true
        }

        # 2. Ajouter les props de performance aux balises Image
        # On ajoute cachePolicy, transition et on remplace resizeMode par contentFit
        if ($content -match "<Image") {
            $content = $content -replace "resizeMode=(['""])([^'""]+)(['""])", 'contentFit=$1$2$3'
            $content = $content -replace "<Image", '<Image cachePolicy="memory-disk" transition={200}'
            $modified = $true
        }
    }

    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "✅ Optimisé : $($file.Name)" -ForegroundColor Cyan
    }
}

Write-Host "`nTerminé ! Toutes les images utilisent maintenant le cache natif d'expo-image." -ForegroundColor Green