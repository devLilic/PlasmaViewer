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
| PV-004 | Completed | 2026-08-30 | FR3 este acum o BrowserWindow separată, fullscreen pe monitorul FR2, fără focus, input sau cursor. Toggle-ul și ajustările FR3 sunt persistate; FR3 rămâne vizibilă când FR2 este ascunsă și se ascunde în siguranță când imaginea implicită lipsește sau devine invalidă. FR2 nu mai folosește fundalul implicit și se afișează numai cu imagine onAIR. La schimbarea sau dispariția monitorului, FR2 și FR3 sunt repoziționate pe același display disponibil. Teste Viewer: 10/10 PASS; TypeScript: PASS. Verificarea manuală pe minimum două monitoare pentru lifecycle, z-order, focus și cursor rămâne necesară. PV-005 a fost activat. |
| PV-005 | Completed | 2026-08-30 | Blocurile FR1 sunt ordonate Fereastră output → Ajustări imagine plasma.test → Poziție și dimensiune FR2. Toggle-ul persistent `Fixează 16:9` este aplicat în Electron main pentru activare, resize nativ, câmpuri, comenzi de bounds și schimbare de monitor; fullscreen păstrează bounds-urile windowed pentru revenire. Teste Viewer/IPC: 14/14 PASS; TypeScript: PASS. Verificarea manuală pentru drag resize, fullscreen → windowed și schimbare de monitor rămâne necesară. PV-006 a fost activat. |
| PV-006 | Completed | 2026-08-30 | FR1 are un mod de sesiune pentru ajustare din taste: săgeți mută FR2, Ctrl+săgeți redimensionează, Shift aplică pasul 10 px, iar Escape oprește modul. Este dezactivat la fullscreen, schimbarea paginii Control și pierderea focusului; controalele editabile sunt excluse. Main process validează în continuare toate bounds-urile și lock-ul 16:9. Teste Viewer/IPC: 14/14 PASS; TypeScript: PASS. Verificarea manuală pe monitor separat pentru key repeat, fullscreen și 16:9 rămâne necesară. PV-007 a fost activat. |
| PV-007 | Completed | 2026-08-30 | Verificare integrată finalizată pentru contracte, persistență, IPC/preload, FR2/FR3, 16:9 și taste. `node node_modules\\vitest\\vitest.mjs run --config vitest.config.ts` a trecut 136/138 teste; cele 2 teste DB eșuează numai deoarece `better-sqlite3` local este compilat pentru Node ABI 130, iar executabilul disponibil este Node ABI 141. Testele Viewer/IPC focalizate trec 14/14, iar `php artisan test --filter=PlasmaViewerIntegrationTest` trece 5/5 (12 aserțiuni). Buildul echivalent `npm run build` a trecut prin `node node_modules\\typescript\\bin\\tsc`, `node node_modules\\vite\\bin\\vite.js build` și `node node_modules\\electron-builder\\cli.js`; artefactul este `release/0.1.0/win-unpacked/PlasmaViewer.exe`. Documentația PlasmaViewer și Laravel este aliniată cu comportamentul v1 implementat. Checklistul manual multi-monitor nu a fost executat în acest mediu și rămâne obligatoriu înainte de livrare operațională. Milestone-ul PV-001–PV-007 este închis. |

## PV-008 — 2026-09-28 — Completed pentru test

Implementate două coloane Control egale, pe întreaga lățime a ferestrei, preview-uri compacte 16:9 și etichete FR2/FR3 în carduri. FR3 are galerie locală persistentă, scroll orizontal local, selecție separată de aplicare și ajustări complete independente. Settings are un singur selector de monitor comun FR2/FR3 și ordinea persistentă a ferestrelor: implicit FR2 = 3 peste FR3 = 1, valori 0–100, egalitate → FR2 deasupra. Migrarea preferă monitorul FR2 disponibil, apoi vechiul FR3, apoi un monitor disponibil. Main validează și copiază imaginile; preload expune IPC tipizat. Imaginea veche este migrată, iar setările originale sunt păstrate în `viewer-settings.pre-dual-preview.json`.

Integrarea HTTP v1 rămâne compatibilă. Conform clarificării utilizatorului, `hide` ascunde complet FR2 și lasă FR3 activ; `disconnect-outputs` oprește ambele. Comenzile de ajustare nu reaplică fullscreen/geometrie/z-order. Închiderea verifică existența conținutului live pe FR2 sau FR3. Nu s-a modificat proiectul Laravel.

Finisările UI solicitate ulterior sunt incluse: panouri de ajustări pliabile, moduri windowed/fullscreen sus-dreapta în preview FR2 și poziție/dimensiuni imediat sub acesta. Tastele mută/redimensionează cu 10 px implicit și 50 px cu Shift. Redenumirea a fost eliminată din UI; X-ul roșu peste miniatură cere confirmare nativă, cu anulare implicită. Anularea nu modifică selecția/setările/fișierele; confirmarea șterge numai copia gestionată și revalidează protecția live după dialog. Headerul și bara de titlu folosesc PlasmaVu; identitatea aplicației, executabilul și locația userData rămân neschimbate, păstrând datele existente.

Verificări actualizate: 58/58 teste Viewer/IPC în 8 fișiere, TypeScript, build Vite renderer/main/preload și `git diff --check` — PASS. Testul Electron real cu profil temporar a trecut 64/64 verificări, inclusiv import, IPC, persistare, HTTP v1, taste 10/50 px în renderer, monitor comun și ordine normală/inversată/egală, pliere fără schimbarea ajustărilor, click X/anulare/acceptare cu răspunsuri de dialog simulate și layout la 860/1120/1920 px cu 10 imagini și nume lungi. O repornire efectivă cu același profil temporar a trecut 8/8 verificări: cele 9 imagini rămase, numele/identificatorii, selecția, fundalul aplicat, ajustările FR3, monitorul/ordinea și brandingul PlasmaVu sunt restaurate. Capturile Control/Settings au fost inspectate vizual. Packaging Windows — PASS; artefactul este `release/dual-preview-test/win-unpacked/PlasmaViewer.exe`. Branch: `codex/fr2-fr3-dual-preview`; versiune păstrată 1.0.1, fără release publicat.

Manual multi-monitor **neexecutat**: schimbarea monitorului comun, hotplug, focus/z-order, observarea flash-urilor, operarea reală din plasma.test și închiderea pe Windows. Repornirea a fost verificată numai cu profilul temporar, fără modificarea datelor aplicației instalate. Verificările hardware rămân necesare înainte de utilizare operațională; testele offscreen și mock-urile nu le înlocuiesc. Pașii de test și rezultatele sunt în [PV-008](task-briefs/PV-008.md). Niciun task următor nu a fost activat.

### PV-008 — follow-up UI — 2026-10-12 — Completed

La solicitarea utilizatorului, panourile de ajustări FR2 și FR3 pornesc acum pliate în PlasmaViewer și rămân expandabile din antet. Verificatorul Electron a fost actualizat să confirme starea compactă inițială, deschiderea/închiderea ambelor panouri și păstrarea ajustărilor la pliere. Testele Viewer/IPC au trecut 73/73; `tsc --noEmit` și verificarea sintaxei verificatorului au trecut. Buildul aplicației nu a fost rulat; verificarea manuală în fereastra desktop rămâne pentru utilizator.

## Format pentru intrări noi

Pentru fiecare task finalizat, înlocuiește sau adaugă un rând care include:

- rezultatul funcțional;
- testele focalizate și rezultatul lor;
- build-ul, dacă brief-ul îl cere;
- verificările manuale multi-monitor;
- observațiile de compatibilitate și migrare;
- taskul activat pentru handover.

Pentru un task blocat, notează cauza, încercările relevante și pasul necesar pentru reluare fără a marca taskul `Completed`.
