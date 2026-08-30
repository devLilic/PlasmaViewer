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
| PV-003 | In progress | 2026-08-30 | Activat după finalizarea PV-002. |

## Format pentru intrări noi

Pentru fiecare task finalizat, înlocuiește sau adaugă un rând care include:

- rezultatul funcțional;
- testele focalizate și rezultatul lor;
- build-ul, dacă brief-ul îl cere;
- verificările manuale multi-monitor;
- observațiile de compatibilitate și migrare;
- taskul activat pentru handover.

Pentru un task blocat, notează cauza, încercările relevante și pasul necesar pentru reluare fără a marca taskul `Completed`.
