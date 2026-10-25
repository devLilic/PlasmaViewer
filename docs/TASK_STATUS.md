# PlasmaViewer Task Status

Acest document arhivează rezultatele taskurilor finalizate și blocajele taskului activ. Starea curentă compactă rămâne în [TASK_INDEX.md](TASK_INDEX.md).

## Baseline

La crearea registrului:

- FR1 controlează o singură fereastră output FR2;
- FR2 poate fi fullscreen sau windowed și își persistă monitorul, topmost și bounds;
- ajustările existente sunt luminozitate, contrast, zoom, poziție X/Y și flip orizontal;
- imaginea implicită este configurată în panoul principal și este randată ca strat în FR2;
- protocolul local implementat este v1;
- nu există încă FR3, saturație, pagină Settings, blocare 16:9 sau mod de ajustare din taste.

Baseline-ul descrie codul existent, nu criterii de acceptare pentru taskurile viitoare.

## Istoric taskuri

| Task | Status | Data | Rezultat și verificări |
|---|---|---|---|
| PV-001 | Completed | 2026-08-30 | Adăugate contractele pentru `saturation`, profilurile persistente ale imaginii, `fr3` și `aspectMode`; resetarea folosește acum profilul persistent. Testele Viewer: 8/8 PASS; TypeScript: PASS. Migrarea fișierelor vechi, round-trip-ul și fallbackurile invalide sunt acoperite prin teste. Verificare manuală multi-monitor: nu este necesară pentru acest task de contract/persistență. PV-002 a fost activat. |
| PV-002 | Completed | 2026-08-30 | Adăugată navigarea FR1 Control/Settings, configurarea imediată a imaginii implicite FR3 și draftul explicit pentru luminozitate, contrast și saturație. Salvarea folosește IPC tipizat, persistă numai profilul de default și nu schimbă imaginea onAIR activă. Teste Viewer/IPC: 10/10 PASS; TypeScript: PASS. Verificarea manuală de navigare, relansare și dialog nativ rămâne necesară. PV-003 a fost activat. |
| PV-003 | Completed | 2026-08-30 | Aplicată saturația în filtrele FR1/FR2 și în dialogul onAIR; Laravel validează contrastul și saturația și construiește payloadul complet. Dialogul preia o singură dată `transformDefaults`, păstrează ajustările locale la polling și folosește fallbackuri 100/100/100 pentru Viewer vechi sau indisponibil. Teste Viewer/IPC: 10/10 PASS; TypeScript: PASS; `PlasmaViewerIntegrationTest`: 5/5 PASS. Verificarea manuală a fluxului onAIR și polling rămâne necesară. PV-004 a fost activat. |
| PV-004 | Completed | 2026-08-30; follow-up 2026-10-24 | FR3 este o BrowserWindow separată, fullscreen pe monitorul FR2, fără focus, input sau cursor. Toggle-ul și ajustările FR3 sunt persistate; FR3 rămâne vizibilă când FR2 este ascunsă și se ascunde în siguranță când imaginea implicită lipsește sau devine invalidă. Follow-up: FR3 rămâne la nivelul Windows `screen-saver`, deasupra taskbarului și ferestrelor obișnuite; FR2 este promovat la același nivel dacă ordinea configurată cere FR2 peste FR3. FR2 nu mai folosește fundalul implicit și se afișează numai cu imagine onAIR. Testele nu au fost rulate pentru follow-up; TypeScript/build și verificarea manuală pe Windows rămân de confirmat. Checklistul manual multi-monitor pentru lifecycle, z-order, focus și cursor rămâne necesar. |
| PV-005 | Completed | 2026-08-30 | Blocurile FR1 sunt ordonate Fereastră output → Ajustări imagine plasma.test → Poziție și dimensiune FR2. Toggle-ul persistent `Fixează 16:9` este aplicat în Electron main pentru activare, resize nativ, câmpuri, comenzi de bounds și schimbare de monitor; fullscreen păstrează bounds-urile windowed pentru revenire. Teste Viewer/IPC: 14/14 PASS; TypeScript: PASS. Verificarea manuală pentru drag resize, fullscreen → windowed și schimbare de monitor rămâne necesară. PV-006 a fost activat. |
| PV-006 | Completed | 2026-08-30; follow-up 2026-10-24 | FR1 are un mod de sesiune pentru ajustare din taste: săgețile mută FR2, `+`/`-` redimensionează proporțional, iar Shift aplică pasul de 50 px tuturor comenzilor. La activare apare infograficul; X, clickul în afara dialogului sau Escape închid și dezactivează modul. Modul se oprește și la fullscreen, schimbarea paginii Control și pierderea focusului; controalele editabile sunt excluse. Main validează bounds-urile și lock-ul 16:9. Testele inițiale Viewer/IPC: 14/14 PASS; la acest follow-up TypeScript și `npx vite build`: PASS; testele nu au fost rulate, iar verificarea manuală pe fereastra Electron rămâne necesară. |
| PV-007 | Completed | 2026-08-30 | Verificare integrată finalizată pentru contracte, persistență, IPC/preload, FR2/FR3, 16:9 și taste. `node node_modules\\vitest\\vitest.mjs run --config vitest.config.ts` a trecut 136/138 teste; cele 2 teste DB eșuează numai deoarece `better-sqlite3` local este compilat pentru Node ABI 130, iar executabilul disponibil este Node ABI 141. Testele Viewer/IPC focalizate trec 14/14, iar `php artisan test --filter=PlasmaViewerIntegrationTest` trece 5/5 (12 aserțiuni). Buildul echivalent `npm run build` a trecut prin `node node_modules\\typescript\\bin\\tsc`, `node node_modules\\vite\\bin\\vite.js build` și `node node_modules\\electron-builder\\cli.js`; artefactul este `release/0.1.0/win-unpacked/PlasmaViewer.exe`. Documentația PlasmaViewer și Laravel este aliniată cu comportamentul v1 implementat. Checklistul manual multi-monitor nu a fost executat în acest mediu și rămâne obligatoriu înainte de livrare operațională. Milestone-ul PV-001–PV-007 este închis. |

## PV-008 — 2026-09-28 — Completed pentru test

Implementate două coloane Control egale, pe întreaga lățime a ferestrei, preview-uri compacte 16:9 și etichete FR2/FR3 în carduri. FR3 are galerie locală persistentă, scroll orizontal local, selecție separată de aplicare și ajustări complete independente. Settings are un singur selector de monitor comun FR2/FR3 și ordinea persistentă a ferestrelor: implicit FR2 = 3 peste FR3 = 1, valori 0–100, egalitate → FR2 deasupra. Migrarea preferă monitorul FR2 disponibil, apoi vechiul FR3, apoi un monitor disponibil. Main validează și copiază imaginile; preload expune IPC tipizat. Imaginea veche este migrată, iar setările originale sunt păstrate în `viewer-settings.pre-dual-preview.json`.

Integrarea HTTP v1 rămâne compatibilă. Conform clarificării utilizatorului, `hide` ascunde complet FR2 și lasă FR3 activ; `disconnect-outputs` oprește ambele. Comenzile de ajustare nu reaplică fullscreen/geometrie/z-order. Închiderea verifică existența conținutului live pe FR2 sau FR3. Nu s-a modificat proiectul Laravel.

Finisările UI solicitate ulterior sunt incluse: panouri de ajustări pliabile, moduri windowed/fullscreen sus-dreapta în preview FR2 și poziție/dimensiuni imediat sub acesta. Tastele mută/redimensionează cu 10 px implicit și 50 px cu Shift. Redenumirea a fost eliminată din UI; X-ul roșu peste miniatură cere confirmare nativă, cu anulare implicită. Anularea nu modifică selecția/setările/fișierele; confirmarea șterge numai copia gestionată și revalidează protecția live după dialog. Headerul și bara de titlu folosesc PlasmaVu; identitatea aplicației, executabilul și locația userData rămân neschimbate, păstrând datele existente.

Verificări actualizate: 58/58 teste Viewer/IPC în 8 fișiere, TypeScript, build Vite renderer/main/preload și `git diff --check` — PASS. Testul Electron real cu profil temporar a trecut 64/64 verificări, inclusiv import, IPC, persistare, HTTP v1, taste 10/50 px în renderer, monitor comun și ordine normală/inversată/egală, pliere fără schimbarea ajustărilor, click X/anulare/acceptare cu răspunsuri de dialog simulate și layout la 860/1120/1920 px cu 10 imagini și nume lungi. O repornire efectivă cu același profil temporar a trecut 8/8 verificări: cele 9 imagini rămase, numele/identificatorii, selecția, fundalul aplicat, ajustările FR3, monitorul/ordinea și brandingul PlasmaVu sunt restaurate. Capturile Control/Settings au fost inspectate vizual. Packaging Windows — PASS; artefactul este `release/dual-preview-test/win-unpacked/PlasmaViewer.exe`. Branch: `codex/fr2-fr3-dual-preview`; versiune păstrată 1.0.1, fără release publicat.

Manual multi-monitor **neexecutat**: schimbarea monitorului comun, hotplug, focus/z-order, observarea flash-urilor, operarea reală din plasma.test și închiderea pe Windows. Repornirea a fost verificată numai cu profilul temporar, fără modificarea datelor aplicației instalate. Verificările hardware rămân necesare înainte de utilizare operațională; testele offscreen și mock-urile nu le înlocuiesc. Pașii de test și rezultatele sunt în [PV-008](task-briefs/PV-008.md). Niciun task următor nu a fost activat.

### PV-008 — follow-up UI — 2026-10-12 — Completed

La solicitarea utilizatorului, panourile de ajustări FR2 și FR3 pornesc acum pliate în PlasmaViewer și rămân expandabile din antet. Verificatorul Electron a fost actualizat să confirme starea compactă inițială, deschiderea/închiderea ambelor panouri și păstrarea ajustărilor la pliere. Testele Viewer/IPC au trecut 73/73; `tsc --noEmit` și verificarea sintaxei verificatorului au trecut. Buildul aplicației nu a fost rulat; verificarea manuală în fereastra desktop rămâne pentru utilizator.

## PV-009 — 2026-10-23 — Completed

Emblema PlasmaVu a fost generată și livrată în `build/icon.png` (1024×1024), `build/icon.ico` (16–256 px), `build/icon.icns` și `public/favicon.ico`/`public/plasmavu-icon.png`. Electron Builder folosește iconul ICO în Windows și ICNS în macOS. `productName`, installerul, shortcuturile desktop/start menu și numele din dezinstalator sunt PlasmaVu. `appId` a rămas `com.devlilic.plasmaviewer`, iar numele executabilului a rămas `PlasmaViewer.exe`.

La pornire, aplicația fixează `userData` la folderul istoric `PlasmaViewer` sub `appData`; setările, galeria și datele de licensing rămân în aceeași locație la actualizare. Identitatea Windows taskbar rămâne `PlasmaViewer` pentru a păstra gruparea/pinning-ul existente. Fereastra de control/output/background și dialogul de închidere afișează PlasmaVu.

Teste focalizate — identitatea userData/taskbar, mesajele de închidere și controller-ul ferestrelor: **32/32 PASS**. `npm run build`: **PASS** la TypeScript și Vite pentru renderer/main/preload. `electron-builder` a produs installerul NSIS fără publicare `release/plasmavu-identity-test/PlasmaVu-1.0.2-x64.exe` și directorul `win-unpacked` cu `PlasmaViewer.exe`. `git diff --check`: **PASS**. Iconurile au fost verificate pentru dimensiuni multiple. Nu a fost instalat installerul și shortcutul desktop nu a fost verificat manual pe Windows.

## PV-010 — 2026-10-23 — Completed

La solicitarea utilizatorului, razele containerelor principale au fost reduse de 20 px la 12 px pe desktop, 10 px sub 860 px și 9 px sub 540 px. Preview-urile, tile-urile, butoanele și câmpurile au raze mai mici, păstrând formele circulare/pill pentru toggle-uri și badge-uri. Layout-ul, spațierile, culorile și dimensiunile nu s-au schimbat.

`npx vite build`: **PASS** pentru renderer, main și preload; `npx tsc --noEmit`: **PASS**; `git diff --check`: **PASS**. Aplicația desktop nu a fost lansată pentru o captură comparativă; verificarea vizuală în runtime rămâne manuală.

## PV-011 — 2026-10-23 — Completed

Bara orizontală a galeriei FR3 folosește acum pista bleumarin și un mâner albastru gradient, cu hover mai luminos și înălțime de 9 px. Au fost eliminate butoanele-săgeată native. Derularea orizontală și comportamentul galeriei nu s-au schimbat; pentru browsere fără pseudoelementele WebKit sunt setate `scrollbar-width: thin` și `scrollbar-color`.

`npx vite build`: **PASS** pentru renderer, main și preload; `npx tsc --noEmit`: **PASS**; `git diff --check`: **PASS**.

## PV-012 — 2026-10-23 — Completed

În colțul stânga sus, iconul leului a fost înlocuit cu iconul PlasmaVu. Textul vizibil „PlasmaVu” a fost scos din antet; `alt="PlasmaVu"` păstrează numele accesibil. O mască CSS cu border radius de 30% ascunde colțurile albe din PNG pe fundalul închis.

`npx vite build`: **PASS** pentru renderer, main și preload; `npx tsc --noEmit`: **PASS**; `git diff --check`: **PASS**.

## PV-013 — 2026-10-23 — Completed

Updaterul GitHub Releases pentru `devLilic/PlasmaViewer` este afișat în pagina Settings numai când configurația production activează modulul. Providerul/repository-ul sunt setate explicit din config înainte de verificări. Utilizatorul poate verifica manual, descărca explicit și instala după descărcare; update-urile nu descarcă automat. Environment-ul production este stabilit pentru aplicația packaged înainte de `loadConfig()` și este moștenit de preload, deoarece buildul main păstrează `process.env.NODE_ENV` dinamic. Textele updaterului au resurse ro/en/ru.

Versiunea `app.getVersion()` apare în bara nativă de titlu ca `PlasmaVu (1.0.2)`; handlerul `page-title-updated` oprește `<title>PlasmaVu</title>` din renderer să o elimine. În interiorul interfeței a rămas numai logo-ul. `electron-builder.json` păstrează providerul public GitHub și targetul NSIS configurat anterior; nu s-a publicat un release.

Teste focalizate auto-update/config/runtime environment/controller: **44/44 PASS**. `npx vite build` (renderer, main, preload): **PASS**. `npx tsc --noEmit`: **PASS**. `git diff --check`: **PASS**. Electron Builder a creat pachetul unpacked în `release/pv013-titlebar-preview/win-unpacked`. Installerul NSIS nu a putut fi produs: mediul fără rețea nu poate descărca runtime-ul Electron sau `winCodeSign`. Verificarea unui release real și instalarea shortcutului rămân neefectuate.

## PV-014 — 2026-10-23 — Completed

Iconul nativ al ferestrei folosește `build/icon.ico` în development și `resources/icon.ico` în pachetul Electron. Assetul complet este copiat în afara ASAR, iar `electron-builder.json` păstrează iconul pentru Windows/installer. Logo-ul a fost eliminat din headerul rendererului; navigarea este centrată, acțiunile rămân în dreapta. Miniaturile galeriei FR3 ocupă 90% din lățimea disponibilă, fără redimensionarea cardurilor.

Test focalizat pentru căile iconului: **2/2 PASS**. `npx tsc --noEmit`: **PASS**. `npx vite build`: **PASS**. Electron Builder a creat pachetul unpacked `release/pv014-icon-preview/win-unpacked`, cu `resources/icon.ico` prezent (160143 bytes), folosind runtime-ul Electron local. `git diff --check`: **PASS**. Installerul NSIS nu a fost creat; lansarea și verificarea vizuală a barei native în Windows rămân manuale.

## PV-015 — 2026-10-24 — Completed

`drizzle-orm` a fost mutat din `devDependencies` în `dependencies`, astfel încât Electron Builder îl include în aplicația instalată. Pachetul unpacked a fost inspectat: `resources/app.asar` conține `node_modules/drizzle-orm` și chunkul main cu importul static. `better-sqlite3` a rămas în development, deoarece funcția bazei de date este dezactivată în configurația Production, iar driverul nativ nu este încărcat la pornirea normală.

TypeScript și buildurile Vite pentru renderer/main/preload: **PASS**. Electron Builder directory-mode cu runtime-ul Electron local și semnarea Windows dezactivată: **PASS**. `git diff --check`: **PASS**. Mediul izolat nu a putut descărca arhiva NSIS, însă installerul generat local `release/1.0.2/PlasmaVu-1.0.2-x64.exe` a fost instalat ulterior. Dezinstalarea anterioară lăsase 12 procese `PlasmaViewer.exe` active; acestea țineau arhiva veche `app.asar` deschisă, astfel încât instalarea inițială a păstrat-o. După oprirea proceselor și reinstalare, hash-ul arhivei instalate a coincis cu pachetul unpacked, iar verificarea ASAR a confirmat `drizzle-orm`. Aplicația instalată a rămas deschisă și răspunde cu titlul `PlasmaVu (1.0.2)`. Testele unitare nu au fost rulate.

## PV-016 — 2026-10-25 — In progress

Modulul database/Drizzle este încărcat dinamic numai când ambele opțiuni `features.database` și `database.enabled` sunt active. În bootstrap, înregistrarea modulelor și pornirea serverului HTTP sunt așteptate înainte de continuarea pornirii; eșecurile sunt raportate într-un dialog, ferestrele/serverul sunt închise, iar procesul iese cu cod non-zero. La quit, serverul nu mai acceptă conexiuni și sunt închise conexiunile loopback active. Dacă confirmarea de închidere aruncă o eroare neașteptată, aplicația finalizează totuși cererea de quit.

`npm run test:unit`: **FAIL**, 186/191 teste trec. Eșecurile sunt în testele bazei de date (driverul `better-sqlite3` are ABI incompatibil cu Node-ul local), `controllerDualPreview.spec.ts` (așteptarea stării topmost pentru FR3) și `keyboardGeometry.spec.ts` (așteptările de resize nu corespund comenzilor produse). TypeScript și buildurile Vite pentru renderer/main/preload: **PASS**. Inspectarea bundle-ului confirmă că entrypoint-ul main nu importă static chunkul `createDatabaseMainModule`; acesta este referit prin `import()` condițional. `npm run build`: **PASS** cu descărcarea runtime-ului Electron permisă; installerul local `release/1.0.2/PlasmaVu-1.0.2-x64.exe` a fost produs. `git diff --check`: **PASS** (doar avertismentele Git despre conversia LF/CRLF). Verificarea manuală a închiderii normale/eșecului de pornire nu a fost efectuată. Taskul rămâne In progress până la remedierea/testarea eșecurilor și verificarea manuală; datele existente ale utilizatorului nu au fost folosite pentru testare.

## Format pentru intrări noi

Pentru fiecare task finalizat, înlocuiește sau adaugă un rând care include:

- rezultatul funcțional;
- testele focalizate și rezultatul lor;
- build-ul, dacă brief-ul îl cere;
- verificările manuale multi-monitor;
- observațiile de compatibilitate și migrare;
- taskul activat pentru handover.

Pentru un task blocat, notează cauza, încercările relevante și pasul necesar pentru reluare fără a marca taskul `Completed`.
