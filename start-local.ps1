# Local development startup script (no Docker)
# Run: .\start-local.ps1

Write-Host "Starting Research Synthesizer (local mode)..." -ForegroundColor Cyan

# Check .env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ".env created from .env.example — please add your OPENAI_API_KEY" -ForegroundColor Yellow
    exit 1
}

$key = (Get-Content ".env" | Where-Object { $_ -match "^OPENAI_API_KEY=sk-" })
if (-not $key) {
    Write-Host "ERROR: OPENAI_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

# Install backend deps
Write-Host "`nInstalling backend dependencies..." -ForegroundColor Green
Set-Location backend
pip install -r requirements.txt --quiet
Set-Location ..

# Install frontend deps
Write-Host "Installing frontend dependencies..." -ForegroundColor Green
Set-Location frontend
npm install --silent
Set-Location ..

# Start backend in background
Write-Host "`nStarting backend on http://localhost:8000" -ForegroundColor Green
Start-Process -FilePath "uvicorn" -ArgumentList "main:app --reload --port 8000" -WorkingDirectory "backend" -WindowStyle Minimized

Start-Sleep -Seconds 2

# Start frontend
Write-Host "Starting frontend on http://localhost:3000" -ForegroundColor Green
Write-Host "`nOpen http://localhost:3000 in your browser" -ForegroundColor Cyan
Set-Location frontend
npm run dev
