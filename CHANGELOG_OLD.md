# Older changes
## 0.1.5 (2026-01-31)
- (skvarel) Improved: Removed unnecessary devDependencies (eslint, should, dotenv) to follow ioBroker best practices.
- (skvarel) Improved: Updated test scripts to use standard mocha command instead of hardcoded paths.
- (skvarel) Improved: Switched Node.js core module imports to node:xxx format where applicable.
- (skvarel) Improved: Enforced minimum and maximum interval limits for data polling to comply with Node.js timer restrictions.
- (skvarel) Improved: Code formatting and configuration files updated for consistency with ioBroker standards.
- (skvarel) Fixed: Addressed review feedback for ioBroker latest repository inclusion.
- (skvarel) Added: Full multi-language support for all state names (EN, DE, RU, PT, NL, FR, IT, ES, PL, UK, ZH-CN).

## 0.1.2 (2026-01-23)
- (skvarel) Fix .vscode/settings.json

## 0.1.1 (2026-01-23)
- (skvarel) Remove mocha from devDependencies (included in @iobroker/testing)
- (skvarel) Add .vscode/settings.json with JSON schema definitions

## 0.1.0 (2026-01-22)
- (skvarel) Initial release
