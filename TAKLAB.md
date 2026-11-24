# OpenTAKServer-UI — fork taklab

Fork `brian7704/OpenTAKServer-UI` dla środowisk taklab.eu. Licencja bez zmian: GPLv3 (plik `LICENSE`).

Gałęzie taklab zaczynają się od `taklab/` i stoją na tagu upstreamu, z którego budowany jest obraz `taklab/ots-ui`.

## taklab/recordings (od v1.7.5)

- Strona „Nagrania” (`/recordings`, `src/pages/Recordings/`): wideo, głosówki i skany OCR z rejestru nagrań forka OTS (`/api/taklab/recordings`). Filtry, podgląd z mapą startu i śladu, pobranie, zmiana nazwy i usunięcie (autor albo administrator), pasek zajętości dla administratora, odnośnik do CloudTAK środowiska.
- Pozycja „Nagrania” w menu, tłumaczenia PL/EN w `public/locales/*/translation.json`.
- `yarn.lock` uzgodniony z `package.json` (upstream na v1.7.5 miał nieaktualny plik, a jego CI buduje przez `npm install` bez blokady wersji).
- `taklab-dev/fake-recordings-api.mjs`: atrapa API do pracy lokalnej i zrzutów ekranu, bez serwera.

Testy: `node .yarn/releases/yarn-4.12.0.cjs vitest` i `npx tsc --noEmit`. `yarn lint` nie działa już w upstreamie (brak `eslint-config-mantine/tsconfig.json`).
