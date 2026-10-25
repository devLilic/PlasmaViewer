# PlasmaViewer Task Index

Acesta este registrul compact al stării curente. Detaliile de implementare se află în brief-ul fiecărui task, iar rezultatele finalizate se arhivează în [TASK_STATUS.md](TASK_STATUS.md).

## Current work

| Câmp | Valoare |
|---|---|
| Task activ | PV-016 — Pornire și oprire robustă. |
| Status | In progress — cazurile de bootstrap și procesele rămase după eroare trebuie închise controlat. |
| Obiectiv | Elimină importurile opționale din pornire și închide curat resursele la erori sau quit. |
| Verificări rămase | Testele unitare au 5 eșecuri (186/191 trec); verificarea manuală a închiderii normale/după eșec de pornire rămâne de făcut. |
| Următorul task eligibil | Niciunul. |

## Registru taskuri

| Task | Status | Dependențe | Rezultat principal |
|---|---|---|---|
| [PV-001](task-briefs/PV-001.md) | Completed | — | Contracte și persistență pentru saturație, defaulturi, FR3 și 16:9. |
| [PV-002](task-briefs/PV-002.md) | Completed | PV-001 | Pagina Settings din FR1 pentru imaginea FR3 și defaulturile de imagine. |
| [PV-003](task-briefs/PV-003.md) | Completed | PV-002 | Saturație completă și sincronizarea defaulturilor cu `plasma.test`. |
| [PV-004](task-briefs/PV-004.md) | Completed | PV-002 | FR3 fullscreen, deasupra taskbarului Windows; FR2/FR3 păstrează ordinea configurată. |
| [PV-005](task-briefs/PV-005.md) | Completed | PV-004 | Reordonarea controalelor FR1 și blocarea dimensiunii FR2 la 16:9. |
| [PV-006](task-briefs/PV-006.md) | Completed | PV-005 | Ajustarea poziției și dimensiunii FR2 din tastatură. |
| [PV-007](task-briefs/PV-007.md) | Completed | PV-003, PV-004, PV-005, PV-006 | Verificare integrată, build și documentație finală. |
| [PV-008](task-briefs/PV-008.md) | Completed | PV-007 | Dual-preview PlasmaVu, galerie verificată după restart, monitor comun în Settings, ordine FR2/FR3 persistentă și panouri de ajustări compacte la pornire. |
| [PV-009](task-briefs/PV-009.md) | Completed | PV-008 | Identitate de produs PlasmaVu și iconuri Windows/macOS/favicon; installer NSIS validat cu executabilul și datele existente păstrate. |
| [PV-010](task-briefs/PV-010.md) | Completed | PV-009 | Rază mai mică pentru cardurile și panourile principale, preview-uri și controale, inclusiv breakpoint-uri mobile. |
| [PV-011](task-briefs/PV-011.md) | Completed | PV-010 | Scroll bar orizontal FR3 cu track bleumarin, thumb albastru/hover și fallback standard. |
| [PV-012](task-briefs/PV-012.md) | Completed | PV-011 | Iconul de antet înlocuit cu emblema PlasmaVu; textul vizibil al numelui este eliminat. |
| [PV-013](task-briefs/PV-013.md) | Completed | PV-012 | Updaterul GitHub Releases disponibil în Settings; titlul nativ afișează versiunea, interfața păstrează doar logo-ul. |
| [PV-014](task-briefs/PV-014.md) | Completed | PV-013 | Icon PlasmaVu în bara nativă, fără logo în headerul rendererului și miniaturi FR3 cu 10% mai mici. |
| [PV-015](task-briefs/PV-015.md) | Completed | PV-014 | `drizzle-orm` este dependență de producție și este inclus în arhiva aplicației. |
| [PV-016](task-briefs/PV-016.md) | In progress | PV-015 | Pornirea/oprirerea aplicației și curățarea serverului/proceselor la erori. |

## Ordine obligatorie

Ordinea normală este PV-001 → PV-002 → PV-003 → PV-004 → PV-005 → PV-006 → PV-007. PV-003 și PV-004 au aceeași bază PV-002, dar se execută secvențial pentru a păstra un singur task activ și un handover clar.

Un task poate fi marcat `Completed` numai conform `AGENTS.md`, `00_WORKING_RULES.md` și criteriilor din brief-ul propriu.
