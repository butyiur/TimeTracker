# Testing Strategy

Ez a mappa a TimeTracker backend tesztelési tervét és a kapcsolódó tesztfájlokat tartalmazza.

## Tesztszintek

1. Unit tesztek
- Cél: gyors visszajelzés üzleti szabályokra és policy logikára.
- Fókusz:
  - jogosultsági policy-k (Employee/HR/Admin kombinációk),
  - dinamikus jelszó policy validáció.

2. Integrációs tesztek
- Cél: API végpontok és adatbázis viselkedésének ellenőrzése.
- Fókusz:
  - auth és role alapú hozzáférés,
  - user státusz váltás (aktiválás/inaktiválás),
  - regisztráció és HR jóváhagyás folyamat,
  - 2FA setup/enable/disable/recovery endpointok.

3. E2E tesztek
- Cél: kritikus felhasználói útvonalak ellenőrzése böngészőből.
- Fókusz:
  - login oldal renderelés és alap auth navigáció,
  - nyilvános auth oldalak közti átjárás.

4. Teljesítménytesztek
- Cél: nyilvános auth API stabilitás és válaszidő ellenőrzése terhelés alatt.
- Fókusz:
  - `GET /api/auth/password-policy`,
  - `POST /api/auth/resend-email-confirmation`,
  - hibaarány és p95 válaszidő.

## Prioritás

1. Unit + integrációs tesztek a backend jogosultsági és auth logikára.
2. Integrációs tesztek a legkockázatosabb HR/Admin műveletekre.
3. Kis számú, stabil E2E regressziós forgatókönyv.
4. K6 alapú teljesítmény smoke teszt az auth nyilvános végpontokra.
