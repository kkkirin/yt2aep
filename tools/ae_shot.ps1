# ae_shot.ps1 : AE のメインウィンドウ(およびダイアログ)の位置を列挙し、メインウィンドウ領域をPNG保存
param([string]$Out = (Join-Path $PSScriptRoot "../output/ae_window.png"), [Parameter(Mandatory=$true)][int]$ProcessId)
New-Item -ItemType Directory -Force -Path (Split-Path -Parent ([System.IO.Path]::GetFullPath($Out))) | Out-Null
Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class AES {
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
 [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
 public struct RECT { public int L,T,R,B; }
 delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
 public static List<string> List(uint pid){ var r=new List<string>(); EnumWindows((h,l)=>{ uint p; GetWindowThreadProcessId(h,out p); if(p==pid && IsWindowVisible(h)){ var sb=new StringBuilder(256); GetWindowText(h,sb,256); var cn=new StringBuilder(256); GetClassName(h,cn,256); RECT rc; GetWindowRect(h,out rc); r.Add(cn+"|"+sb+"|"+rc.L+"|"+rc.T+"|"+rc.R+"|"+rc.B);} return true;}, IntPtr.Zero); return r;}
}
"@
$p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if ($p -and $p.ProcessName -ne "AfterFX") { throw "ProcessId must identify AfterFX" }
if (-not $p) { Write-Output "no AE"; exit }
$wins = [AES]::List([uint32]$p.Id)
$main = $null
foreach ($w in $wins) { $f = $w.Split("|"); Write-Output ("win: [" + $f[0] + "] " + $f[1] + "  " + $f[2] + "," + $f[3] + "-" + $f[4] + "," + $f[5]); if ($f[0] -like "AE_CApplication*") { $main = $f } }
if ($main) {
  $x=[int]$main[2]; $y=[int]$main[3]; $w=[int]$main[4]-$x; $h=[int]$main[5]-$y
  $bmp = New-Object System.Drawing.Bitmap $w,$h; $g=[System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($x,$y,0,0,(New-Object System.Drawing.Size($w,$h))); $bmp.Save([System.IO.Path]::GetFullPath($Out)); Write-Output ("saved " + $Out + " " + $w + "x" + $h)
}
