# Modes Directory

This directory isolates mode-specific code so changes in one mode are less likely to affect others.

- `words`: word mode logic, hooks, and related utilities
- `sentences`: sentence mode logic, AI generation utilities, and API proxy
- `longtext`: long text mode modules (to be incrementally migrated)
- `sequential`: sequential mode modules (to be incrementally migrated)
- `random`: random mode modules (to be incrementally migrated)
- `position`: position mode modules (to be incrementally migrated)
- `common`: shared mode helpers that are not auth-related
  - `components`: shared layout/panel components
  - `utils`: shared utility modules
  - `hooks`: shared hooks used across multiple modes
