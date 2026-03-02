# Changelog

All notable changes to the DASE extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of DASE - Design-Aided Software Engineering
- ORM Designer for visual database modeling
- Support for `.dsorm` files
- DBML import/export functionality
- AI-powered table organization
- AI-powered SQL script generation
- AI-powered ORM code generation
- Properties panel for element configuration
- Issues panel for validation feedback
- TFX framework for core functionality

### Features
- Visual table creation and editing
- Field management with data type support
- Primary key and foreign key relationships
- Reference line routing with collision avoidance
- Validation system with error/warning reporting
- Configuration system with hierarchical file search

## [1.0.0] - TBD

### Added
- First stable release
- Complete ORM Designer functionality
- Full test coverage (100%)
- GitHub Actions CI/CD pipeline

---

## Release Types

- **Major (X.0.0)**: Breaking changes or major new features
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes and minor improvements
- **Pre-release (X.Y.Z-alpha/beta/rc.N)**: Testing versions

## How to Update

1. Download the latest `.vsix` from [Releases](../../releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
4. Select the downloaded file

Or install from VS Code Marketplace (when available):
```
ext install tootega.dase
```
