Add-Type -AssemblyName System.Drawing
$ink = [System.Drawing.ColorTranslator]::FromHtml("#07090E")
$green = [System.Drawing.ColorTranslator]::FromHtml("#00F5A0")
foreach ($sz in @(192, 512)) {
  [int]$size = $sz
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $r = $size / 5.5
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
  $path.AddArc($size - $r * 2, 0, $r * 2, $r * 2, 270, 90)
  $path.AddArc($size - $r * 2, $size - $r * 2, $r * 2, $r * 2, 0, 90)
  $path.AddArc(0, $size - $r * 2, $r * 2, $r * 2, 90, 90)
  $path.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush($ink)), $path)
  $w = [float]($size / 16)
  $pen = New-Object System.Drawing.Pen($green, $w)
  $m = [float]($size * 0.30)
  $g.DrawLine($pen, $m, $size - $m, $m, $m)
  $g.DrawLine($pen, $m, $m, $size - $m, $size - $m)
  $g.DrawLine($pen, $size - $m, $size - $m, $size - $m, $m)
  $out = "nodo/public/icons/pwa-$size.png"
  New-Item -ItemType Directory -Force -Path "nodo/public/icons" | Out-Null
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "OK $out"
}
