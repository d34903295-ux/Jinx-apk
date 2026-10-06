Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("C:\Users\Administrator\Downloads\file_00000000b164820eba1c64a2db57e247.png")
$side = [Math]::Min($src.Width, $src.Height)
$box = [int]($side * 0.62)
$x = [int](($src.Width - $box) / 2)
$y = [int](($src.Height - $box) / 2)
$crop = New-Object System.Drawing.Bitmap($box, $box)
$g = [System.Drawing.Graphics]::FromImage($crop)
$dst = New-Object System.Drawing.Rectangle(0, 0, $box, $box)
$sr = New-Object System.Drawing.Rectangle($x, $y, $box, $box)
$g.DrawImage($src, $dst, $sr.X, $sr.Y, $sr.Width, $sr.Height, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$dens = @{ "xxxhdpi" = 192; "xxhdpi" = 144; "xhdpi" = 96; "hdpi" = 72; "mdpi" = 48 }
foreach ($d in $dens.Keys) {
  $dir = "app/src/main/res/mipmap-$d"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Remove-Item "$dir/ic_launcher.webp" -Force -ErrorAction SilentlyContinue
  Remove-Item "$dir/ic_launcher_round.webp" -Force -ErrorAction SilentlyContinue
  foreach ($n in @("ic_launcher", "ic_launcher_round")) {
    $bmp = New-Object System.Drawing.Bitmap($crop, $dens[$d], $dens[$d])
    $bmp.Save("$dir/$n.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  }
}
New-Item -ItemType Directory -Force -Path "nodo/public/icons" | Out-Null
$crop.Save("nodo/public/logo-jinx.png", [System.Drawing.Imaging.ImageFormat]::Png)
foreach ($s in @(192, 512)) {
  $bmp = New-Object System.Drawing.Bitmap($crop, $s, $s)
  $bmp.Save("nodo/public/icons/pwa-$s.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
$crop.Dispose(); $src.Dispose()
Write-Output "iconos generados"
