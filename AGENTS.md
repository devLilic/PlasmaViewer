# PlasmaViewer — Instrucțiuni pentru agenți

## Scop

PlasmaViewer este aplicația Electron care controlează ferestrele de afișare pentru imaginile trimise de aplicația Laravel `plasma.test`. Acest fișier este punctul obligatoriu de intrare pentru orice agent care modifică repository-ul PlasmaViewer sau integrarea sa cu `plasma.test`.

## Înainte de orice modificare

Citește integral, în această ordine:

1. `AGENTS.md`;
2. `docs/00_WORKING_RULES.md`;
3. `docs/TASK_INDEX.md`;
4. brief-ul legat pentru singurul task marcat `In progress` în `docs/task-briefs/`;
5. numai documentele de contract sau ghidurile indicate explicit de brief.

Brief-ul taskului activ este sursa operațională de adevăr pentru scope, dependențe, contracte, criterii de acceptare și verificări. `docs/PLASMA_VIEWER_PROTOCOL.md` descrie exclusiv comportamentul deja implementat; nu îl interpreta drept promisiune pentru taskurile încă nefinalizate.

## Reguli de lucru

- Lucrează la un singur task `In progress`.
- Nu începe un task dependent înainte ca toate dependențele lui să fie `Completed`.
- Inspectează codul și testele existente înainte de editare.
- Aplică TDD pentru logica de contracte, normalizare, persistență și geometrie.
- Implementează cea mai mică schimbare completă care satisface brief-ul.
- Nu include refactorizări, upgrade-uri sau funcționalități fără legătură cu taskul activ.
- Păstrează modificările locale neasumate și nu suprascrie munca utilizatorului.
- Nu presupune că un comportament dintr-un task `Pending` este deja disponibil.

## Limite arhitecturale obligatorii

- Electron main deține ferestrele, filesystem-ul, dialogurile native, persistența și celelalte operații privilegiate.
- Preload expune numai API-uri înguste și tipizate.
- Renderer-ul nu accesează direct Node.js, Electron sau căi locale.
- Contractele comune și logica pură rămân în `src/shared/`.
- Accesul renderer → main folosește exclusiv IPC tipizat.
- Serverul Viewer continuă să asculte numai pe loopback și să valideze tokenul Bearer.
- Extensiile protocolului v1 trebuie să fie compatibile cu comenzile v1 existente, conform brief-ului activ.
- Textul nou vizibil utilizatorului trebuie să poată fi localizat; nu extinde hardcodarea existentă fără justificare în task.

## Ferestre și denumiri

- `FR1`: fereastra de control PlasmaViewer.
- `FR2`: fereastra de output pentru imaginea onAIR.
- `FR3`: fereastra fullscreen de fundal, planificată prin taskurile active.
- Folosește întotdeauna `FR2`, nu `FM2`.
- Ajustarea intensității culorilor se numește `Saturație`, iar câmpul de contract este `saturation`.

## Testare și Definition of Done

Pentru fiecare task:

1. adaugă sau actualizează mai întâi testele focalizate pentru logica schimbată;
2. rulează testele unitare strict relevante;
3. rulează verificările suplimentare cerute explicit în brief;
4. inspectează diferențele înainte de finalizare;
5. actualizează documentația de stare și contractele afectate.

Un task este `Completed` numai dacă:

- toate criteriile de acceptare din brief sunt îndeplinite;
- testele focalizate trec;
- aplicația încă se construiește sau rulează atunci când wiring-ul runtime a fost schimbat;
- documentele care descriu comportamentul implementat sunt actualizate;
- nu au fost introduse modificări în afara scope-ului.

Verificările manuale care necesită mai multe monitoare nu trebuie declarate automatizate. Înregistrează clar ce rămâne de verificat manual.

## Actualizarea taskurilor

La finalizarea taskului activ:

1. marchează taskul `Completed` în `docs/TASK_INDEX.md`;
2. adaugă în `docs/TASK_STATUS.md` data, rezultatul, testele și verificările manuale;
3. actualizează brief-ul dacă implementarea aprobată a clarificat detalii fără a-i schimba scope-ul;
4. actualizează `docs/PLASMA_VIEWER_PROTOCOL.md` și ghidurile conexe numai cu comportamentul efectiv implementat;
5. marchează următorul task neblocat drept `In progress` și actualizează tabelul `Current work`.

Dacă taskul este blocat, păstrează-l `In progress`, descrie blocajul în brief și în `docs/TASK_STATUS.md` și nu activa un task nou.

## Documente de referință

- `docs/README.md` — harta documentației;
- `docs/DEVELOPMENT_WORKFLOW.md` — disciplina generală de dezvoltare;
- `docs/PLASMA_VIEWER_PROTOCOL.md` — contractul local implementat;
- `docs/GHID_PORNIRE_SI_DEZVOLTARE_PROIECT.md` — setup, build și operare;
- documentele de licensing — contracte independente, care nu se modifică pentru taskurile Viewer decât dacă brief-ul o cere explicit.
