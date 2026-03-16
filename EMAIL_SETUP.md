# Email setup (forgot/reset password)

A jelszó-visszaállítás e-mail küldéshez töltsd ki az `Email` szekciót a `appsettings.Development.json` fájlban, vagy add meg environment változóként.

## Kötelező mezők

- `Email:From`
- `Email:SmtpHost`
- `Email:SmtpPort`
- `Email:UseSsl`
- `Email:UserName` (ha a szolgáltató igényli)
- `Email:Password` (ha a szolgáltató igényli)
- `Email:PasswordResetSpaBaseUrl` (pl. `http://localhost:4200`)

## Gyors ellenőrzés

1. Nyisd meg a SPA-ban az `Elfelejtett jelszó` oldalt.
2. Kérj visszaállító linket egy létező fiókra.
3. Ha nincs SMTP beállítva, a levél tartalma ide kerül:
   - `TimeTracker.Api/App_Data/dev-mailbox.log`

## Environment változók példa (PowerShell)

```powershell
$env:Email__From = "no-reply@yourdomain.com"
$env:Email__SmtpHost = "smtp.yourprovider.com"
$env:Email__SmtpPort = "587"
$env:Email__UseSsl = "true"
$env:Email__UserName = "smtp-user"
$env:Email__Password = "smtp-password"
$env:Email__PasswordResetSpaBaseUrl = "http://localhost:4200"
```

.NET automatikusan felülírja az appsettings értékeket ezekkel.
