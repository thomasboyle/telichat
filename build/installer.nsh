; Custom NSIS script for TeliChat installer
; This script handles closing running instances and app data deletion

!macro preInit
  ; Check if the application is running before installation
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq TeliChat.exe" /FO CSV | find /C "TeliChat.exe"'
  Pop $0
  Pop $1
  
  ${If} $1 > 0
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "TeliChat is currently running. Do you want to close it and continue with the installation?" IDYES +2
    Abort
    nsExec::Exec 'taskkill /F /IM "TeliChat.exe"'
    Sleep 2000
  ${EndIf}
!macroend

!macro customInit
  ; Custom initialization code
!macroend

!macro customInstall
  ; Custom installation code
!macroend

!macro customUnInit
  ; Check for running TeliChat processes
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq TeliChat.exe" /FO CSV | find /C "TeliChat.exe"'
  Pop $0
  Pop $1
  
  ${If} $1 > 0
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "TeliChat is currently running. Do you want to close it and continue with uninstallation?" IDYES continue_uninstall
    Abort
    
    continue_uninstall:
    DetailPrint "Closing TeliChat..."
    nsExec::Exec 'taskkill /F /IM "TeliChat.exe"'
    Sleep 2000
  ${EndIf}
  
  ; Ask user if they want to delete app data
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove all chat history and application data?$\n$\nThis will permanently delete all your conversation history and settings." IDNO skip_data_deletion
  
  ; Delete app data if user chose yes
  DetailPrint "Removing application data..."
  RMDir /r "$APPDATA\TeliChat"
  RMDir /r "$LOCALAPPDATA\TeliChat"
  RMDir /r "$APPDATA\telichat-react-ts"
  RMDir /r "$LOCALAPPDATA\telichat-react-ts"
  
  skip_data_deletion:
!macroend

!macro customUnInstall
  ; Final cleanup
  DetailPrint "Performing final cleanup..."
  Delete "$TEMP\TeliChat*.*"
  DetailPrint "Uninstallation completed successfully."
!macroend 