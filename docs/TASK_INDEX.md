# PlasmaViewer Task Index

Acesta este registrul compact al stării curente. Detaliile de implementare se află în brief-ul fiecărui task, iar rezultatele finalizate se arhivează în [TASK_STATUS.md](TASK_STATUS.md).

## Current work

| Câmp | Valoare |
|---|---|
| Task activ | [PV-004 — Fereastra fullscreen FR3](task-briefs/PV-004.md) |
| Status | In progress |
| Obiectiv | Fereastra fullscreen FR3 și controlul ei persistent. |
| Blocaj | Niciunul cunoscut. |
| Următorul task eligibil | PV-004 este activ. |

## Registru taskuri

| Task | Status | Dependențe | Rezultat principal |
|---|---|---|---|
| [PV-001](task-briefs/PV-001.md) | Completed | — | Contracte și persistență pentru saturație, defaulturi, FR3 și 16:9. |
| [PV-002](task-briefs/PV-002.md) | Completed | PV-001 | Pagina Settings din FR1 pentru imaginea FR3 și defaulturile de imagine. |
| [PV-003](task-briefs/PV-003.md) | Completed | PV-002 | Saturație completă și sincronizarea defaulturilor cu `plasma.test`. |
| [PV-004](task-briefs/PV-004.md) | In progress | PV-002 | Fereastra fullscreen FR3 și controlul ei persistent. |
| [PV-005](task-briefs/PV-005.md) | Pending | PV-004 | Reordonarea controalelor FR1 și blocarea dimensiunii FR2 la 16:9. |
| [PV-006](task-briefs/PV-006.md) | Pending | PV-005 | Ajustarea poziției și dimensiunii FR2 din tastatură. |
| [PV-007](task-briefs/PV-007.md) | Pending | PV-003, PV-004, PV-005, PV-006 | Verificare integrată, build și documentație finală. |

## Ordine obligatorie

Ordinea normală este PV-001 → PV-002 → PV-003 → PV-004 → PV-005 → PV-006 → PV-007. PV-003 și PV-004 au aceeași bază PV-002, dar se execută secvențial pentru a păstra un singur task activ și un handover clar.

Un task poate fi marcat `Completed` numai conform `AGENTS.md`, `00_WORKING_RULES.md` și criteriilor din brief-ul propriu.
