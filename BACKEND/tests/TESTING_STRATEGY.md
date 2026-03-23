# Testing Strategy

Ez a mappa a TimeTracker backend tesztelési tervét és tesztprojektjeit tartalmazza.

## Tesztszintek

1. Unit tesztek
- Cél: gyors visszajelzés üzleti szabályokra és policy logikára.
- Fókusz:
  - jogosultsági policy-k (Employee/HR/Admin kombinációk),
  - jelszó policy alapú validáció.

2. Integrációs tesztek
- Cél: API végpontok és adatbázis viselkedésének ellenőrzése.
- Fókusz:
  - auth és role alapú hozzáférés,
  - user státusz váltás (aktiválás/inaktiválás),
  - regisztráció és jóváhagyás folyamat.

3. E2E tesztek
- Cél: kritikus üzleti folyamatok végponttól végpontig ellenőrzése.
- Fókusz:
  - bejelentkezés és átirányítás szerepkör alapján,
  - HR/Admin felhasználó-kezelési flow,
  - időbejegyzés és jóváhagyás fő útvonal.

## Prioritás

1. Unit + integrációs tesztek a backend jogosultsági és auth logikára.
2. Integrációs tesztek a legkockázatosabb HR/Admin műveletekre.
3. Kis számú (4-6) E2E regressziós forgatókönyv.
