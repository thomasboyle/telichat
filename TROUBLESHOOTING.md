# TeliChat Update Troubleshooting Guide

## Issue: "Checking for updates" but nothing happens

### Most Common Causes & Solutions

#### 1. **Development Mode Detection (Most Likely Cause)**
**Problem**: Updates are disabled in development mode
**Check**: Look for `VITE_DEV_SERVER_URL` environment variable
**Solution**: 
```bash
# Make sure you're running the production build
npm run build
# Then run the built executable from release/ folder
```

#### 2. **Missing GitHub Release Assets**
**Problem**: `latest.yml` not uploaded to GitHub releases
**Check**: Go to https://github.com/thomasboyle/telichat/releases/latest
**Solution**: 
- Ensure `latest.yml` file is in the release assets
- Re-publish if missing: `npm run publish`

#### 3. **Network/Firewall Issues**
**Problem**: Can't reach GitHub API
**Test**: Try accessing https://api.github.com/repos/thomasboyle/telichat/releases/latest
**Solution**: Check firewall/antivirus settings

#### 4. **Version Comparison Issue**
**Problem**: Current version >= latest version
**Check**: Compare app version vs latest GitHub release
**Solution**: Create a new release with higher version number

#### 5. **Auto-updater Timeout**
**Problem**: Update check hangs indefinitely
**Solution**: Added timeout mechanism (already implemented)

### Debug Steps

#### Step 1: Check Current Environment
1. Open Windows PowerShell as Administrator
2. Navigate to your project: `cd "D:\C++\WindowsApp\ai-model-switcher"`
3. Check environment: `echo $env:VITE_DEV_SERVER_URL`
4. If it shows a URL, that's why updates are disabled

#### Step 2: Test with Production Build
1. Build the app: `npm run build`
2. Run the executable from `release/1.0.25/TeliChat-Windows-1.0.25-Setup.exe`
3. Try checking for updates from the installed app

#### Step 3: Verify GitHub Release
1. Go to: https://github.com/thomasboyle/telichat/releases/latest
2. Check if `latest.yml` is in the assets
3. Check if the version number is higher than your current version (1.0.25)

#### Step 4: Test Network Connectivity
1. Test API access: 
```powershell
Invoke-RestMethod -Uri "https://api.github.com/repos/thomasboyle/telichat/releases/latest"
```

#### Step 5: Enable Debug Logs
The main.ts file has been updated with extensive debug logging. Check the console for:
- "=== UPDATE CHECK REQUESTED ==="
- AutoUpdater configuration details
- Any error messages

### Common Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Updates are disabled in development mode" | VITE_DEV_SERVER_URL is set | Run production build |
| "Update check timed out" | Network/server issue | Check internet connection |
| "Cannot find latest.yml" | Missing release asset | Re-publish release |
| "Update not available" + current version = latest version | No newer version | Create new release |

### Quick Fix Commands

```bash
# If you need to create a new test release
npm version patch
git push origin main --follow-tags

# If you need to rebuild and test
npm run build
cd release/1.0.25
./TeliChat-Windows-1.0.25-Setup.exe

# If you need to check what's in your latest release
curl https://api.github.com/repos/thomasboyle/telichat/releases/latest
```

### Manual Verification

1. **Check your GitHub releases**: https://github.com/thomasboyle/telichat/releases
2. **Verify latest.yml exists** in the release assets
3. **Compare versions**: Your app shows 1.0.25, is there a 1.0.26+ available?
4. **Test from installed app**, not from development environment

### If All Else Fails

Run the debug script:
```bash
node update-debug.js
```

This will test:
- Environment variables
- GitHub API connectivity
- Local file existence
- Version information

### Still Not Working?

Check the Electron console logs when running the production app:
1. Install the app from GitHub releases
2. Open the app
3. Press `Ctrl+Shift+I` to open DevTools
4. Go to Console tab
5. Click "Check for Updates" in Settings
6. Look for debug messages starting with "=== UPDATE CHECK REQUESTED ===" 