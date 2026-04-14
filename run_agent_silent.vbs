Set objShell = CreateObject("WScript.Shell")
strScript = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\")) & "cloud_local_agent.py"
objShell.Run "pythonw.exe """ & strScript & """", 0, False
