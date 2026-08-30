# PlasmaViewer Working Rules

## Contextul taskului

Înainte de implementare citește `AGENTS.md`, acest document, `TASK_INDEX.md` și brief-ul singurului task `In progress`. Brief-ul este sursa operațională de adevăr pentru schimbarea curentă.

Nu folosi taskurile `Pending` ca specificație pentru codul taskului activ, cu excepția contractelor viitoare indicate explicit drept dependență. Nu actualiza documentele de comportament curent înainte ca funcționalitatea să existe și să fie verificată.

## Ordinea de lucru

1. Confirmă taskul `In progress` și dependențele lui.
2. Verifică starea Git și inspectează implementarea existentă.
3. Identifică testele și contractele direct afectate.
4. Scrie sau actualizează testul focalizat pentru logica nouă.
5. Implementează schimbarea minimă, păstrând limitele Electron.
6. Rulează testele focalizate și verificările cerute în brief.
7. Inspectează diferențele și verifică fiecare criteriu de acceptare.
8. Actualizează indexul, statusul și documentele de contract implementat.
9. Activează următorul task numai dacă taskul curent este complet și dependențele următorului sunt închise.

## Reguli pentru scope

- Un task nu poate absorbi cerințe din taskurile următoare doar pentru comoditate.
- Schimbările comune strict necesare contractului activ pot fi introduse numai dacă sunt descrise în brief.
- Integrarea Laravel din `D:\laragon\www\plasma` se modifică numai în taskurile care o includ explicit.
- Documentele de licensing, auto-update, app protection și database sunt în afara taskurilor PV-001–PV-007.
- `PLASMA_VIEWER_PROTOCOL.md` și ghidul de conectare din proiectul Laravel se actualizează cu starea reală, nu anticipat.

## Arhitectură și date persistente

- Ferestrele Electron și filesystem-ul sunt controlate în main.
- Renderer-ul folosește API-uri preload tipizate.
- Contractele partajate și normalizările pure se păstrează în `src/shared/`.
- Modificările formatului `viewer-settings.json` trebuie să fie additive și să ofere fallback pentru fișiere vechi, incomplete sau invalide.
- Valorile persistente trebuie validate și normalizate la citire, nu doar în UI.
- O extensie compatibilă a protocolului v1 trebuie să accepte payloadurile v1 existente și să aplice fallbackurile documentate.

## TDD și verificări

Prioritatea testelor este:

1. teste unitare pentru contracte, normalizare, migrare și geometrie;
2. teste de integrare focalizate pentru IPC și integrarea Laravel–Viewer;
3. verificare manuală pentru ferestre reale, z-order și configurații multi-monitor.

Nu adăuga infrastructură E2E grea pentru comportamente care pot fi protejate prin funcții pure și teste unitare. Un build este obligatoriu în taskul final de integrare și în orice task anterior care nu poate fi validat adecvat fără el.

## Finalizare și handover

La `Completed`, `TASK_STATUS.md` trebuie să înregistreze:

- data;
- rezultatul implementat;
- testele și rezultatul lor;
- verificările manuale efectuate sau rămase;
- observații de migrare/compatibilitate;
- următorul task activat.

La `Blocked`, înregistrează cauza exactă, ce a fost verificat și primul pas necesar pentru reluare. Nu modifica statusul taskurilor dependente.
