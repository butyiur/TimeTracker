# E2E és Teljesítményteszt futtatás

## Frontend E2E (Playwright)

1. Első futtatás előtt:
```powershell
cd C:\EGYETEM\SZAKDOLGOZAT\APPLICATION\TimeTracker.Api\FRONTEND
npx playwright install
```

2. App indítása:
```powershell
cd C:\EGYETEM\SZAKDOLGOZAT\APPLICATION\TimeTracker.Api\FRONTEND
npm start
```

3. E2E futtatás:
```powershell
cd C:\EGYETEM\SZAKDOLGOZAT\APPLICATION\TimeTracker.Api\FRONTEND
npm run test:e2e
```

Headed mód:
```powershell
cd C:\EGYETEM\SZAKDOLGOZAT\APPLICATION\TimeTracker.Api\FRONTEND
npm run test:e2e:headed
```

Alapértelmezett URL: `http://localhost:4200`.  
Ha más URL-t használsz:
```powershell
$env:E2E_BASE_URL = "http://localhost:4300"
npm run test:e2e
```

## Backend teljesítményteszt (k6)

1. API indítása:
```powershell
cd C:\EGYETEM\SZAKDOLGOZAT\APPLICATION\TimeTracker.Api\BACKEND
dotnet run
```

2. k6 script futtatása:
```powershell
k6 run C:\EGYETEM\SZAKDOLGOZAT\APPLICATION\TimeTracker.Api\BACKEND\tests\performance\k6-auth-public.js
```

Alapértelmezett URL: `https://localhost:7037`.  
Ha más URL-t használsz:
```powershell
$env:K6_BASE_URL = "https://localhost:7443"
k6 run C:\EGYETEM\SZAKDOLGOZAT\APPLICATION\TimeTracker.Api\BACKEND\tests\performance\k6-auth-public.js
```

## Mit fed le ez a csomag?

- Frontend E2E:
  - `/login` oldal renderelése
  - fő CTA-k (Belépés, Regisztráció, Elfelejtett jelszó) megjelenése
  - navigáció `/register` és `/forgot-password` oldalakra
- Backend performance:
  - nyilvános auth endpointok válaszideje és hibaaránya:
    - `GET /api/auth/password-policy`
    - `POST /api/auth/resend-email-confirmation`
