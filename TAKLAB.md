# OpenTAKServer-UI — fork taklab

Fork `brian7704/OpenTAKServer-UI` dla środowisk taklab.eu. Licencja bez zmian: GPLv3 (plik `LICENSE`).

Gałęzie taklab zaczynają się od `taklab/` i stoją na tagu upstreamu, z którego budowany jest obraz `taklab/ots-ui`.

## taklab/recordings (od v1.7.5)

- Strona „Nagrania” (`/recordings`, `src/pages/Recordings/`): wideo, głosówki i skany OCR z rejestru nagrań forka OTS (`/api/taklab/recordings`). Filtry, podgląd z mapą startu i śladu, pobranie, zmiana nazwy, usunięcie, pasek zajętości, odnośnik do CloudTAK środowiska.
- Od decyzji usera z 24 XI 2026 cała strona jest tylko dla roli `administrator` OTS (gałąź forka OTS `taklab/recordings-admin`). Pozycji w menu nie widzi nikt inny, a pod adresem `/recordings` dostaje krótki komunikat bez zapytań do API. Rolę strona czyta z `localStorage` (`administrator`), jak reszta panelu; gdy serwer i tak odpowie 403, pokazuje ten sam komunikat.
- Pola wyboru w tabeli, „Pobierz zaznaczone (ZIP)” (`GET /api/taklab/recordings/archive?ids=a,b`, do 100) i „Pobierz wszystkie z filtrem (ZIP)” (`?all=1` z filtrami `kind`, `account`, `from`, `to` w ISO 8601). Oba przyciski to zwykłe odnośniki z `download`: przeglądarka wysyła ciasteczko sesji i zapisuje strumień od razu na dysk.
- Pozycja „Nagrania” w menu, tłumaczenia PL/EN w `public/locales/*/translation.json`.
- `yarn.lock` uzgodniony z `package.json` (upstream na v1.7.5 miał nieaktualny plik, a jego CI buduje przez `npm install` bez blokady wersji).
- `taklab-dev/fake-recordings-api.mjs`: atrapa API do pracy lokalnej i zrzutów ekranu, bez serwera. Konto z ciasteczka `fake_user`; tylko `administrator` dostaje dane, reszta 403. Trasa `archive` zwraca mały ZIP z przykładowymi plikami. Żeby wejść na stronę bez logowania, ustaw w `localStorage` `loggedIn=true` i `administrator=true`.

Testy: `node .yarn/releases/yarn-4.12.0.cjs vitest` i `npx tsc --noEmit`. `yarn lint` nie działa już w upstreamie (brak `eslint-config-mantine/tsconfig.json`).
