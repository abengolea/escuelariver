# Configura la contrasena SMTP (App Password de Gmail) en Secret Manager.
# Uso: .\scripts\set-smtp-secret.ps1
# Te pide la contrasena y la sube al secreto de la extension Trigger Email.

$ErrorActionPreference = "Stop"

Write-Host "Listando secretos del proyecto (buscando SMTP)..." -ForegroundColor Cyan
$secrets = gcloud secrets list --format="value(name)" 2>$null
$smtpSecret = $secrets | Where-Object { $_ -match "SMTP_PASSWORD|smtp-password" } | Select-Object -First 1

if (-not $smtpSecret) {
    Write-Host "No se encontro un secreto SMTP_PASSWORD. Secretos disponibles:" -ForegroundColor Yellow
    gcloud secrets list --format="table(name)"
    $smtpSecret = Read-Host "Ingresa el nombre completo del secreto (ej: firestore-send-email-SMTP_PASSWORD)"
}

$secretName = $smtpSecret -replace "^projects/[^/]+/secrets/", ""
Write-Host "Usando secreto: $secretName" -ForegroundColor Green
Write-Host ""
Write-Host "=== CONTRASENA DE APLICACION (no es tu contrasena normal de Gmail) ===" -ForegroundColor Cyan
Write-Host "1. Entra a: https://myaccount.google.com/security" -ForegroundColor White
Write-Host "2. Verificacion en 2 pasos: tiene que estar ACTIVADA." -ForegroundColor White
Write-Host "3. Contrasenas de aplicaciones: crea una para Correo u Otro (nombre: Trigger Email)." -ForegroundColor White
Write-Host "4. Google te muestra 16 caracteres (ej: abcd efgh ijkl mnop)." -ForegroundColor White
Write-Host "5. Esa contrasena tiene que ser de la cuenta: noresponderescuelariversn@gmail.com" -ForegroundColor White
Write-Host ""
Write-Host "Cuando la tengas, pegala abajo (podes pegar con espacios, el script los quita):" -ForegroundColor Yellow
Write-Host ""

$tempFile = [System.IO.Path]::GetTempFileName()
try {
    $password = Read-Host "Contrasena de aplicacion (16 caracteres)"
    $password = $password -replace "\s", ""
    if ($password.Length -ne 16) {
        Write-Host "Aviso: la contrasena de aplicacion suele tener 16 caracteres. Tenes $($password.Length). Continuar igual? (s/n)" -ForegroundColor Yellow
        if ((Read-Host).ToLower() -ne "s") { exit 1 }
    }
    [System.IO.File]::WriteAllText($tempFile, $password, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Subiendo nueva version del secreto..." -ForegroundColor Cyan
    gcloud secrets versions add $secretName --data-file=$tempFile
    Write-Host "Listo. La extension Trigger Email usara la nueva contrasena." -ForegroundColor Green
} finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
}
