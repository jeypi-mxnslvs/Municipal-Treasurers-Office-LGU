# Phase 6 Pilot Evidence

## Status

Engineering execution is complete on `phase-6-pilot-verification`. The mandatory human pilot gate remains pending: the Municipal Treasurer and Municipal Assessor must validate the statutory schedule and approve the SOA and Section 254 Notice formats before Phase 7.

No linked Supabase project or municipal dataset was changed. The pilot fixture is synthetic and contains no taxpayer personal data.

## Evidence index

| Evidence | Result |
|---|---|
| Sanitized 33-barangay masterlist | [`evidence/phase6/pilot_masterlist.csv`](evidence/phase6/pilot_masterlist.csv) |
| Dataset SHA-256 | `d448f1711175bf51f1db4671528a66f58ffd921e87df742bd5df1b2398d0d813` |
| Import and functional tests | `utils/phase6Pilot.test.ts`: 8 automated pilot tests |
| Calculation comparison | [`evidence/phase6/calculation_comparison.csv`](evidence/phase6/calculation_comparison.csv) |
| SOA review sample | [`evidence/phase6/soa_review_sample.csv`](evidence/phase6/soa_review_sample.csv) |
| Section 254 Notice review sample | [`evidence/phase6/notice_review_sample.csv`](evidence/phase6/notice_review_sample.csv) |
| Authorization/concurrency/restore | [`evidence/phase6/backup_restore_log.txt`](evidence/phase6/backup_restore_log.txt) |
| Defect register | [`evidence/phase6/defect_register.csv`](evidence/phase6/defect_register.csv) |
| Reproducible drill | `scripts/phase6-pilot-drill.sh` |

## Pilot checklist disposition

| # | Verification | Disposition |
|---:|---|---|
| 1 | Sanitized representative import covering all 33 barangays | Automated pass; 33 unique canonical barangays and zero parser errors. |
| 2 | Duplicate TD, conflicting record, invalid numeric/class, missing AV, shell, idempotent re-import | Automated pass. |
| 3 | Historical AV with physical RPTAR volume/folio | Automated pass using synthetic `RPTAR Vol. PILOT-14 Folio 22`; physical-book accuracy requires Assessor review. |
| 4 | Current and historical penalty schedules | Automated calculations match the coded schedule with zero variance; approved-policy confirmation is pending Treasurer/Assessor signatures. |
| 5 | Arrears-first, multi-year, quarter split | Automated pass, including stable period keys `2024`, `2025`, `2026-q12`, `2026-q34`. |
| 6 | External settlement official reference | Automated and disposable-database pass with `OFFICIAL-EXT-2025-0001`. |
| 7 | Disputed and superseded paths | Automated pass. |
| 8 | Shell verification and clearance prohibition | Automated pass. |
| 9 | SOA/CSV Basic-SEF comparison | Automated pass; Basic and SEF are each `3187.98`, total `6375.96`. Format approval pending. |
| 10 | Section 254 Notice/CSV | Automated pass; Basic and SEF are each `3340.17`, total `6680.34`. Official format approval pending. |
| 11 | Clearance states | Outstanding, unverified, disputed, historical-gap, archived guard, shell, and fully resolved paths covered. |
| 12 | Admin, Assessor, maintenance negative permissions | Disposable-database and migration-boundary tests pass. |
| 13 | Concurrent assessor verification and import | Disposable-database pass. |
| 14 | Backup and restore with pilot data | Clean-target restore pass; source and restored fingerprints match. |

## Defect and acceptance review

- The reproducible restore drill found one tooling-only P3 issue and closed it by disabling only user-defined triggers during isolated data replay, then re-enabling them before fingerprint and RLS checks.
- No unresolved P0 or P1 defect is recorded in the Phase 6 defect register.
- Automated representative workflows and the restore drill pass.
- Human statutory-policy and official-format approval are not self-certified and remain the Phase 6-to-7 gate.

## Human pilot approval record

| Review | Name / signature | Date | Decision / remarks |
|---|---|---|---|
| Municipal Treasurer — statutory schedule and SOA/Notice format |  |  |  |
| Municipal Assessor — valuation provenance and pilot workflow |  |  |  |
| Database owner/operator — restore drill acknowledgement |  |  |  |

Phase 7 must not begin until the required municipal reviewers complete this record and dispose any resulting P0/P1 findings.
