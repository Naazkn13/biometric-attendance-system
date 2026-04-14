Set objShell = CreateObject("WScript.Shell")
strScript = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\")) & "andheri_relay.py"
objShell.Run "pythonw.exe """ & strScript & """", 0, False
