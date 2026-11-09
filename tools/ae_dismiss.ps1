# ae_dismiss.ps1 : AEのモーダルダイアログ(#32770)を監視し、スクリプト進捗ダイアログ以外に WM_CLOSE を送る
param([int]$Seconds = 60, [int]$Every = 2, [Parameter(Mandatory=$true)][int]$ProcessId)
Add-Type -TypeDefinition @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class AED {
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
 [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
 delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
 public static List<string> Dialogs(uint pid){ var r=new List<string>(); EnumWindows((h,l)=>{ uint p; GetWindowThreadProcessId(h,out p); if(p==pid && IsWindowVisible(h)){ var cn=new StringBuilder(256); GetClassName(h,cn,256); if(cn.ToString()=="#32770"){ var sb=new StringBuilder(256); GetWindowText(h,sb,256); r.Add(h.ToInt64()+"|"+sb);} } return true;}, IntPtr.Zero); return r;}
}
"@
$p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if ($p -and $p.ProcessName -ne "AfterFX") { throw "ProcessId must identify AfterFX" }
if (-not $p) { Write-Output "no AE"; exit }
$t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt $Seconds) {
  foreach ($d in [AED]::Dialogs([uint32]$p.Id)) {
    $f = $d.Split("|", 2); $h = [IntPtr]([int64]$f[0]); $title = $f[1]
    if ($title -match "\.jsx") { continue }   # script progress dialog
    Write-Output ("close: " + $title)
    [AED]::SendMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
  }
  Start-Sleep -Seconds $Every
}
