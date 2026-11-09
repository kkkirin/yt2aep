# ae_dialog_print.ps1 : PrintWindow で AE のモーダルダイアログを(他ウィンドウに隠れていても)PNG 化。-Enter で OK(Enter) を送る
param([string]$OutDir = (Join-Path $PSScriptRoot "../output/dialogs"), [switch]$Enter, [Parameter(Mandatory=$true)][int]$ProcessId)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class AEPW {
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
 [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
 public struct RECT { public int L,T,R,B; }
 delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
 public static List<IntPtr> Dialogs(uint pid){ var r=new List<IntPtr>(); EnumWindows((h,l)=>{ uint p; GetWindowThreadProcessId(h,out p); if(p==pid && IsWindowVisible(h)){ var cn=new StringBuilder(256); GetClassName(h,cn,256); if(cn.ToString()=="#32770") r.Add(h);} return true;}, IntPtr.Zero); return r;}
 public static string Title(IntPtr h){ var sb=new StringBuilder(256); GetWindowText(h,sb,256); return sb.ToString(); }
}
"@
$p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if ($p -and $p.ProcessName -ne "AfterFX") { throw "ProcessId must identify AfterFX" }
if (-not $p) { Write-Output "no AE"; exit }
$i = 0
foreach ($h in [AEPW]::Dialogs([uint32]$p.Id)) {
  $rc = New-Object AEPW+RECT; [AEPW]::GetWindowRect($h, [ref]$rc) | Out-Null
  $w = $rc.R - $rc.L; $hh = $rc.B - $rc.T; if ($w -le 0 -or $hh -le 0) { continue }
  $bmp = New-Object System.Drawing.Bitmap $w,$hh; $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc(); [AEPW]::PrintWindow($h, $hdc, 2) | Out-Null; $g.ReleaseHdc($hdc)
  $out = Join-Path $OutDir ("dialog_pw_" + $i + ".png"); $bmp.Save($out)
  Write-Output ("dialog[" + [AEPW]::Title($h) + "] " + $w + "x" + $hh + " -> " + $out)
  if ($Enter) { [AEPW]::PostMessage($h, 0x0100, [IntPtr]0x0D, [IntPtr]::Zero) | Out-Null; [AEPW]::PostMessage($h, 0x0101, [IntPtr]0x0D, [IntPtr]::Zero) | Out-Null; Write-Output "  -> Enter sent" }
  $i++
}
if ($i -eq 0) { Write-Output "no dialog" }
