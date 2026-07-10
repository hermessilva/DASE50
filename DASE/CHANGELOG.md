# Change Log

All notable changes to the **DASE — Design-Aided Software Engineering** extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.41879] - 2026-07-10

### Fixed

- **MCP server no longer collides across VS Code windows.** The embedded server used a
  fixed loopback port (`39100`) and a single shared `mcp-endpoint.json`, so a second
  window failed with `EADDRINUSE` and windows overwrote each other's discovery file. The
  default port is now `0` (OS-assigned), giving each window its own free port, and each
  window writes a per-window discovery file (`mcp-endpoint.<hash>.json`) tagged with its
  `workspacePath` and `pid`. Stale files from crashed windows are purged by liveness
  check. The shared `mcp-endpoint.json` is still written for external clients.

## [1.0.41878] - 2026-07-10

### Added

- **MCP: 1:1 references (inheritance).** `dase_add_reference` accepts `oneToOne=true`, linking the source table's PK directly to the target (PK→PK, no FK field) — the MCP equivalent of Ctrl+dragging an anchor in the designer.
- **MCP: `dase_new_document`.** Create a named `.dsorm` file at a defined destination (absolute or workspace-relative path), with optional overwrite; missing folders are created and the document opens in the designer.
- **MCP: `dase_move_reference_target`.** Re-point an existing FK reference at a different target table, matching the designer's "move FK target" gesture.

### Changed

- **MCP server no longer requires authentication.** The per-session Bearer token was removed; clients connect with the endpoint URL alone. Security remains loopback-only bind plus the `Origin` allowlist (anti DNS-rebind), and the server stays off by default.
- **MCP: `dase_save_document` reports the real result.** The save is now awaited and the response carries the saved path or the actual error; untitled documents get a message pointing to `dase_new_document`.

## [1.0.41876] - 2026-07-02

### Changed

- **Line router v2 — cooperative routing.** Reference lines are now routed with a shared occupancy map: each route sees the lines already placed and pays a cost for stacking on the same track or crossing them, so parallel relationships spread into distinct lanes instead of piling up in corridors.
- **Congestion-aware arrow anchors.** Tables with many incoming references (hubs) distribute arrows across multiple borders by capacity; entry side selection now estimates the real route cost (including going around the table), so arrows enter through the nearest facing border — straight into the bottom/top when the source sits below/above.
- **Orthogonal lane nudging.** Residual near-parallel segments are pulled apart into 10px lanes ordered by approach side, validated against table bounds — no more overlapping line bundles.
- **No more hooks and hairpins.** Routes must arrive at the target aligned with the entry arrow and can never double back over themselves, eliminating loops next to table borders.

### Fixed

- Routes no longer cut through tables: the fallback pass that ignored obstacles was replaced by a safe orthogonal L/Z fallback, and the source/target tables themselves now count as obstacles.
- Full reroute of large diagrams no longer freezes the designer (100 tables / 300 references: ~30s → under 1s; typical models route in under 20ms).
- Deterministic routing: rerouting the same diagram twice yields identical lines.

## [1.0.0] - 2026-07-02

### Added

- **Visual ORM Designer** — custom editor for `.dsorm` files to design entity-relationship models visually.
- **Table & field editing** — add, rename, and delete tables and fields via context menus.
- **Foreign key references** — create and auto-route relationships between tables.
- **Real-time validation** — detect duplicate names, missing primary keys, dangling FK references, and empty tables.
- **DBML interop** — export the model to DBML and import DBML into `.dsorm`.
- **AI integration** — chat participant `@dase` plus language model tools to query, modify, and organize the model.
- **AI table organization** — infer functional groups from names and relationships, then cluster and color-code tables.
- **Properties & Issues panels** — inspect and edit element properties and view validation issues.
- **Detach designer** — open the designer in a separate window.

[1.0.41878]: https://github.com/hermessilva/DASE50/releases
[1.0.41876]: https://github.com/hermessilva/DASE50/releases
[1.0.0]: https://github.com/hermessilva/DASE50/releases
