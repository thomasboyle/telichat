# TeliChat - Development & Release Guide

This guide provides comprehensive instructions for developing, building, and releasing TeliChat to GitHub.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Commands](#development-commands)
- [Build Commands](#build-commands)
- [GitHub Release Process](#github-release-process)
- [Manual Release Steps](#manual-release-steps)
- [Automated Release Steps](#automated-release-steps)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

## Prerequisites

Before starting development or creating releases, ensure you have:

### Required Software
- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Git**: For version control
- **PowerShell**: For Windows development (pre-installed on Windows)

### GitHub Setup
- GitHub account with access to the repository
- GitHub Personal Access Token (for releases)
- Repository secrets configured (for automated releases)

### Installation
```bash
# Clone the repository
git clone https://github.com/thomasboyle/telichat.git
cd ai-model-switcher

# Install dependencies
npm install
```

## Development Commands

### Start Development Server
```bash
npm run dev
```
- Starts the Vite development server
- Enables hot module replacement
- App runs in development mode with debugging enabled

### Code Quality
```bash
# Run ESLint to check code quality
npm run lint

# Preview the built application locally
npm run preview
```

## Build Commands

### Standard Build
```bash
npm run build
```
**Process:**
1. Compiles TypeScript (`tsc`)
2. Builds the frontend with Vite (`vite build`)
3. Packages the Electron app for Windows (`electron-builder --win`)

### Alternative Build Commands
```bash
# Windows-specific build
npm run build:win

# Equivalent to npm run build
npm run dist

# Rebuild dependencies and build
npm run rebuild
```

### Draft Build (No Publishing)
```bash
npm run draft
```
- Creates release files without publishing to GitHub
- Useful for testing builds locally
- Files are saved to `release/{version}/` directory

## GitHub Release Process

### Version Management

The project uses semantic versioning (SemVer). Current version is defined in `package.json`:

```json
{
  "version": "1.0.20"
}
```

## Manual Release Steps

Follow these steps in order for a manual release:

### 1. Prepare Release
```bash
# Ensure you're on the main branch
git checkout main

# Pull latest changes
git pull origin main

# Update version in package.json (manually edit or use npm)
npm version patch  # for 1.0.20 -> 1.0.21
# or
npm version minor  # for 1.0.20 -> 1.1.0
# or
npm version major  # for 1.0.20 -> 2.0.0
```

### 2. Build and Test
```bash
# Clean build
npm run rebuild

# Test the build locally
npm run draft
```

### 3. Commit and Tag
```bash
# Commit version changes
git add package.json package-lock.json
git commit -m "chore: bump version to v1.0.21"

# Create and push tag
git tag v1.0.21
git push origin main
git push origin v1.0.21
```

### 4. Manual Publish
```bash
# Set GitHub token (required for publishing)
$env:GH_TOKEN = "your_github_token_here"  # PowerShell
# or
export GH_TOKEN="your_github_token_here"  # Bash

# Publish to GitHub Releases
npm run publish
```

## Automated Release Steps

The project includes a GitHub Actions workflow that automatically builds and releases when you push a version tag.

### 1. Update Version
```bash
# Update version in package.json
npm version patch

# This creates a commit and tag automatically
```

### 2. Push Changes
```bash
# Push the version commit and tag
git push origin main --follow-tags
```

### 3. Automatic Process
The GitHub Actions workflow (`.github/workflows/build.yml`) will:
1. Detect the new tag (format: `v*`)
2. Check out the code
3. Install Node.js and dependencies
4. Build the application
5. Publish to GitHub Releases automatically

## Environment Variables

### Required for Releases

**GH_TOKEN**: GitHub Personal Access Token
- **Local Development**: Set manually before running publish commands
- **GitHub Actions**: Configured as repository secret

#### Creating a GitHub Token
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo` (full repository access)
4. Copy the token and store it securely

#### Setting the Token Locally
```bash
# PowerShell
$env:GH_TOKEN = "ghp_your_token_here"

# Command Prompt
set GH_TOKEN=ghp_your_token_here

# Git Bash
export GH_TOKEN="ghp_your_token_here"
```

## Troubleshooting

### Common Build Issues

**Issue**: `tsc` compilation errors
```bash
# Solution: Check TypeScript configuration
npx tsc --noEmit  # Check for type errors without building
```

**Issue**: Electron builder fails
```bash
# Solution: Clear cache and rebuild
npm run rebuild
```

**Issue**: Publishing fails with authentication error
```bash
# Solution: Verify GitHub token
echo $env:GH_TOKEN  # PowerShell
# Should show your token, not empty
```

### GitHub Actions Issues

**Issue**: Workflow not triggering
- Ensure tag format is `v*` (e.g., `v1.0.21`)
- Check that the tag was pushed: `git push origin --tags`

**Issue**: Build fails in GitHub Actions
- Check the Actions tab in your GitHub repository
- Verify `GH_TOKEN` secret is set in repository settings
- Ensure all dependencies are properly listed in `package.json`

### Release Asset Issues

**Issue**: Installer not created
- Check `electron-builder.json5` configuration
- Verify Windows target configuration
- Ensure icon file exists (currently references deleted icon)

**Action Required**: Update icon path in `electron-builder.json5`:
```json
{
  "icon": "build/icon.ico",  // Update this path
  "win": {
    "icon": "build/icon.ico"  // Update this path too
  }
}
```

## Project Structure

```
ai-model-switcher/
├── .github/
│   └── workflows/
│       └── build.yml              # Automated build workflow
├── build/                         # Build configuration files
├── dist/                         # Built frontend assets
├── dist-electron/                # Built Electron main process
├── electron/                     # Electron main process source
├── public/                       # Static assets
├── release/                      # Built application packages
├── src/                          # React frontend source
├── electron-builder.json5        # Electron builder configuration
├── package.json                  # Project dependencies and scripts
├── vite.config.ts               # Vite build configuration
└── HELP.md                      # This file
```

## Release Artifacts

Each release creates these files in `release/{version}/`:
- `TeliChat-Windows-{version}-Setup.exe` - NSIS installer
- `TeliChat-Windows-{version}-Portable.exe` - Portable executable
- `latest.yml` - Auto-updater metadata

## Quick Reference

### Most Common Commands
```bash
# Development
npm run dev

# Build for testing
npm run draft

# Create release
npm version patch && git push origin main --follow-tags

# Manual publish (if needed)
npm run publish
```

### Version Bump Shortcuts
```bash
npm version patch   # 1.0.20 → 1.0.21 (bug fixes)
npm version minor   # 1.0.20 → 1.1.0  (new features)
npm version major   # 1.0.20 → 2.0.0  (breaking changes)
```

---

**Note**: This project is configured for Windows builds. For cross-platform builds, additional configuration in `electron-builder.json5` would be required. 