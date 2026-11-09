# ae_dialog_click.ps1 : AE モーダルダイアログの指定点(ウィンドウ左上基準 px)をメッセージでクリック。既定は Adobe 汎用エラーダイアログの OK 位置
param([int]$X = 425, [int]$Y = 226, [Parameter(Mandatory=$true)][int]$ProcessId)
Add-Type -TypeDefinition @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class AECK {
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr h, ref POINT p);
 [DllImport("user32.dll")] public static extern IntPtr ChildWindowFromPointEx(IntPtr h, POINT p, uint flags);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
 public struct RECT { public int L,T,R,B; }
 public struct POINT { public int X,Y; }
 delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
 public static List<IntPtr> Dialogs(uint pid){ var r=new List<IntPtr>(); EnumWindows((h,l)=>{ uint p; GetWindowThreadProcessId(h,out p); if(p==pid && IsWindowVisible(h)){ var cn=new StringBuilder(256); GetClassName(h,cn,256); if(cn.ToString()=="#32770") r.Add(h);} return true;}, IntPtr.Zero); return r;}
 public static string Click(IntPtr h, int x, int y){
   RECT rc; GetWindowRect(h, out rc);
   POINT sp = new POINT(); sp.X = rc.L + x; sp.Y = rc.T + y;
   POINT cp = sp; ScreenToClient(h, ref cp);
   IntPtr child = ChildWindowFromPointEx(h, cp, 0x0001 | 0x0002 | 0x0004);
   IntPtr target = (child == IntPtr.Zero) ? h : child;
   POINT tp = sp; ScreenToClient(target, ref tp);
   IntPtr lp = (IntPtr)((tp.Y << 16) | (tp.X & 0xFFFF));
   PostMessage(target, 0x0200, IntPtr.Zero, lp);           // WM_MOUSEMOVE
   PostMessage(target, 0x0201, (IntPtr)1, lp);              // WM_LBUTTONDOWN
   PostMessage(target, 0x0202, IntPtr.Zero, lp);            // WM_LBUTTONUP
   return "clicked target=" + target + " client=" + tp.X + "," + tp.Y;
 }
}
"@
$p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if ($p -and $p.ProcessName -ne "AfterFX") { throw "ProcessId must identify AfterFX" }
if (-not $p) { Write-Output "no AE"; exit }
$ds = [AECK]::Dialogs([uint32]$p.Id)
if ($ds.Count -eq 0) { Write-Output "no dialog"; exit }
foreach ($h in $ds) { Write-Output ([AECK]::Click($h, $X, $Y)) }
