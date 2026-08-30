# Documentația PlasmaViewer

Acest director separă documentele operaționale, contractele implementate și ghidurile de referință. `AGENTS.md` din rădăcina repository-ului stabilește ordinea obligatorie de citire.

## Documente operaționale

| Document | Rol |
|---|---|
| [00_WORKING_RULES.md](00_WORKING_RULES.md) | Reguli pentru alegerea, implementarea și finalizarea unui task. |
| [TASK_INDEX.md](TASK_INDEX.md) | Registrul compact al taskurilor, dependențelor și stării curente. |
| [TASK_STATUS.md](TASK_STATUS.md) | Istoricul rezultatelor, testelor, verificărilor manuale și blocajelor. |
| [task-briefs/](task-briefs/) | Scope-ul și criteriile de acceptare pentru fiecare task de implementare. |
| [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) | Reguli generale TDD, testare și Definition of Done. |

Pentru lucru curent se citesc numai regulile, indexul și brief-ul taskului `In progress`. Documentele de referință se deschid când brief-ul le indică sau când trebuie clarificat un contract existent.

## Contracte implementate

| Document | Rol |
|---|---|
| [PLASMA_VIEWER_PROTOCOL.md](PLASMA_VIEWER_PROTOCOL.md) | Protocolul local și comportamentul Viewer implementat în codul curent. |
| [LICENSING_BACKEND_API_CONTRACT.md](LICENSING_BACKEND_API_CONTRACT.md) | Contractul API pentru licensing. |
| [LICENSING_DEVICE_BINDING.md](LICENSING_DEVICE_BINDING.md) | Regulile de legare a licenței de dispozitiv și instalare. |

`PLASMA_VIEWER_PROTOCOL.md` nu descrie funcționalități doar planificate. El se actualizează în același task care livrează schimbarea de comportament.

## Ghiduri și reguli de proiect

| Document | Rol |
|---|---|
| [GHID_PORNIRE_SI_DEZVOLTARE_PROIECT.md](GHID_PORNIRE_SI_DEZVOLTARE_PROIECT.md) | Pornire, configurare, testare și build. |
| [TEMPLATE_RULES.md](TEMPLATE_RULES.md) | Invariantele starterului Electron și limitele arhitecturale. |
| [CODEX_PROJECT_INIT_WORKFLOW.md](CODEX_PROJECT_INIT_WORKFLOW.md) | Fluxul generic de inițializare a unei aplicații din starter. |

## Convenții de stare

- `In progress`: singurul task autorizat pentru implementare.
- `Pending`: task planificat, încă neactivat.
- `Blocked`: task activ care nu poate continua fără o decizie sau o dependență externă.
- `Completed`: toate criteriile de acceptare și verificările obligatorii au fost îndeplinite.

Detaliile viitoare apar în briefuri. Dovezile de finalizare apar în `TASK_STATUS.md`. Indexul rămâne compact și nu duplică implementarea.
