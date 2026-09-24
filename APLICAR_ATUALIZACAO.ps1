$ErrorActionPreference = 'Stop'

$Repo = 'C:\Users\eduardo\Downloads\hora-marcada-vercel-github-vercel'
$ZipCandidates = @(
    (Join-Path $env:USERPROFILE 'Downloads\hora-marcada-area-cliente-com-script.zip'),
    (Join-Path $env:USERPROFILE 'Downloads\hora-marcada-area-cliente.zip')
)
$Zip = $ZipCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$Tmp = Join-Path $env:TEMP ('hora-marcada-update-' + [guid]::NewGuid().ToString('N'))

Write-Host '=== Hora Marcada | Área do Cliente ===' -ForegroundColor Cyan

if (-not (Test-Path $Repo)) {
    throw "Projeto não encontrado em: $Repo"
}
if (-not $Zip) {
    throw 'ZIP não encontrado na pasta Downloads. Baixe primeiro hora-marcada-area-cliente-com-script.zip.'
}

Set-Location $Repo

Write-Host '[1/7] Conferindo repositório Git...' -ForegroundColor Yellow
if (-not (Test-Path '.git')) { throw 'A pasta informada não é um repositório Git.' }

$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Falha ao consultar o Git.' }
if ($dirty) {
    Write-Host 'Existem alterações locais. O script vai interromper para não sobrescrever trabalho.' -ForegroundColor Red
    git status --short
    throw 'Faça commit/stash das alterações locais e rode novamente.'
}

Write-Host '[2/7] Atualizando master...' -ForegroundColor Yellow
git checkout master
if ($LASTEXITCODE -ne 0) { throw 'Falha ao acessar a branch master.' }
git pull --ff-only origin master
if ($LASTEXITCODE -ne 0) { throw 'Falha no git pull. Resolva antes de continuar.' }

Write-Host '[3/7] Extraindo atualização...' -ForegroundColor Yellow
New-Item -ItemType Directory -Path $Tmp -Force | Out-Null
Expand-Archive -Path $Zip -DestinationPath $Tmp -Force

Write-Host '[4/7] Copiando arquivos para o projeto...' -ForegroundColor Yellow
Get-ChildItem -Path $Tmp -Force | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $Repo -Recurse -Force
}

Write-Host '[5/7] Validando TypeScript e build...' -ForegroundColor Yellow
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck falhou. Nenhum push foi realizado.' }

npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build falhou. Nenhum push foi realizado.' }

Write-Host '[6/7] Criando commit...' -ForegroundColor Yellow
git add app lib supabase README.md
if ($LASTEXITCODE -ne 0) { throw 'Falha no git add.' }

$changes = git status --porcelain
if (-not $changes) {
    Write-Host 'Nenhuma alteração nova para enviar.' -ForegroundColor Green
    Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
    exit 0
}

git status --short
git commit -m 'Add client booking portal with phone and PIN'
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar commit.' }

Write-Host '[7/7] Enviando para GitHub...' -ForegroundColor Yellow
git push origin master
if ($LASTEXITCODE -ne 0) { throw 'Falha no git push.' }

Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Concluído.' -ForegroundColor Green
Write-Host 'GitHub atualizado e a Vercel deve iniciar o deploy automaticamente.'
Write-Host 'Área do cliente: https://hora-marcada-ten.vercel.app/cliente/hora-marcada'
