param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeIcon {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool DestroyIcon(IntPtr handle);
}
"@

function New-RoundedRectPath(
  [System.Drawing.RectangleF]$Rect,
  [single]$Radius
) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($Radius -le 0) {
    $path.AddRectangle($Rect)
    return $path
  }

  $diameter = $Radius * 2
  $arc = New-Object System.Drawing.RectangleF($Rect.X, $Rect.Y, $diameter, $diameter)
  $path.AddArc($arc, 180, 90)
  $arc.X = $Rect.Right - $diameter
  $path.AddArc($arc, 270, 90)
  $arc.Y = $Rect.Bottom - $diameter
  $path.AddArc($arc, 0, 90)
  $arc.X = $Rect.X
  $path.AddArc($arc, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-MedQIcon(
  [int]$IconSize,
  [string]$OutPath,
  [bool]$Maskable = $false,
  [bool]$SmallMode = $false
) {
  $bitmap = New-Object System.Drawing.Bitmap($IconSize, $IconSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $paddingRatio = if ($Maskable) {
      0.03
    } elseif ($SmallMode) {
      0.08
    } else {
      0.06
    }

    $margin = [single]($IconSize * $paddingRatio)
    $tileSize = [single]($IconSize - (2 * [double]$margin))
    $tile = [System.Drawing.RectangleF]::new([single]$margin, [single]$margin, [single]$tileSize, [single]$tileSize)
    $cornerRadius = [single]($tile.Width * 0.24)
    $tilePath = New-RoundedRectPath $tile $cornerRadius

    $bgStart = [System.Drawing.Color]::FromArgb(255, 14, 45, 92)
    $bgEnd = [System.Drawing.Color]::FromArgb(255, 11, 132, 165)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      ([System.Drawing.PointF]::new([single]$tile.Left, [single]$tile.Top)),
      ([System.Drawing.PointF]::new([single]$tile.Right, [single]$tile.Bottom)),
      $bgStart,
      $bgEnd
    )
    $graphics.FillPath($bgBrush, $tilePath)
    $bgBrush.Dispose()

    # Soft highlight keeps the icon from looking flat on launchers.
    $highlightLeft = [single]($tile.Left + ($tile.Width * 0.05))
    $highlightTop = [single]($tile.Top + ($tile.Height * 0.04))
    $highlightWidth = [single]($tile.Width * 0.9)
    $highlightHeight = [single]($tile.Height * 0.56)
    $highlightRect = [System.Drawing.RectangleF]::new($highlightLeft, $highlightTop, $highlightWidth, $highlightHeight)
    $highlightPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $highlightPath.AddEllipse($highlightRect)
    $highlightBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($highlightPath)
    $highlightBrush.CenterColor = [System.Drawing.Color]::FromArgb(62, 255, 255, 255)
    $highlightBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
    $graphics.FillPath($highlightBrush, $highlightPath)
    $highlightBrush.Dispose()
    $highlightPath.Dispose()

    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 255, 255, 255), [single][Math]::Max(1, $IconSize * 0.012))
    $graphics.DrawPath($borderPen, $tilePath)
    $borderPen.Dispose()

    $cx = [single]($IconSize / 2.0)
    $cy = [single]($IconSize / 2.0)
    $ringDiameter = [single]($tile.Width * $(if ($SmallMode) { 0.48 } else { 0.52 }))
    $ringStroke = [single][Math]::Max(2, $IconSize * $(if ($SmallMode) { 0.10 } else { 0.11 }))
    $ringLeft = [single]($cx - ($ringDiameter / 2.0))
    $ringTop = [single]($cy - ($ringDiameter / 2.0))
    $ringRect = [System.Drawing.RectangleF]::new($ringLeft, $ringTop, [single]$ringDiameter, [single]$ringDiameter)

    $white = [System.Drawing.Color]::FromArgb(245, 255, 255, 255)
    $ringPen = New-Object System.Drawing.Pen($white, $ringStroke)
    $ringPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $ringPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawEllipse($ringPen, $ringRect)

    $tailPen = New-Object System.Drawing.Pen($white, [single]($ringStroke * 0.84))
    $tailPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tailPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tailStart = [System.Drawing.PointF]::new([single]($cx + ($ringDiameter * 0.24)), [single]($cy + ($ringDiameter * 0.24)))
    $tailEnd = [System.Drawing.PointF]::new([single]($cx + ($ringDiameter * 0.51)), [single]($cy + ($ringDiameter * 0.51)))
    $graphics.DrawLine($tailPen, $tailStart, $tailEnd)
    $tailPen.Dispose()

    if (-not $SmallMode) {
      $innerDiameter = [single]($ringDiameter - ($ringStroke * 1.2))
      $innerLeft = [single]($cx - ($innerDiameter / 2.0))
      $innerTop = [single]($cy - ($innerDiameter / 2.0))
      $innerRect = [System.Drawing.RectangleF]::new($innerLeft, $innerTop, [single]$innerDiameter, [single]$innerDiameter)
      $innerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
      $innerPath.AddEllipse($innerRect)
      $graphics.SetClip($innerPath)

      $pulsePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 93, 243, 220), [single][Math]::Max(1, $IconSize * 0.04))
      $pulsePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pulsePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      [System.Drawing.PointF[]]$pulse = @(
        ([System.Drawing.PointF]::new([single]($cx - ($ringDiameter * 0.34)), [single]($cy + ($ringDiameter * 0.06)))),
        ([System.Drawing.PointF]::new([single]($cx - ($ringDiameter * 0.18)), [single]($cy + ($ringDiameter * 0.06)))),
        ([System.Drawing.PointF]::new([single]($cx - ($ringDiameter * 0.10)), [single]($cy - ($ringDiameter * 0.14)))),
        ([System.Drawing.PointF]::new([single]($cx + ($ringDiameter * 0.02)), [single]($cy + ($ringDiameter * 0.20)))),
        ([System.Drawing.PointF]::new([single]($cx + ($ringDiameter * 0.12)), [single]($cy - ($ringDiameter * 0.02)))),
        ([System.Drawing.PointF]::new([single]($cx + ($ringDiameter * 0.30)), [single]($cy - ($ringDiameter * 0.02))))
      )
      $graphics.DrawLines($pulsePen, $pulse)
      $pulsePen.Dispose()

      $graphics.ResetClip()
      $innerPath.Dispose()
    }

    $ringPen.Dispose()
    $tilePath.Dispose()

    $outDir = Split-Path -Parent $OutPath
    if ($outDir) {
      New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }

    $bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Write-FaviconIco(
  [int]$IconSize,
  [string]$OutPath
) {
  $tempPng = [System.IO.Path]::GetTempFileName()
  try {
    Draw-MedQIcon -IconSize $IconSize -OutPath $tempPng -SmallMode $true
    $bmp = [System.Drawing.Bitmap]::FromFile($tempPng)
    $iconHandle = $bmp.GetHicon()
    try {
      $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
      $outDir = Split-Path -Parent $OutPath
      if ($outDir) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
      }
      $stream = [System.IO.File]::Open($OutPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
      try {
        $icon.Save($stream)
      } finally {
        $stream.Dispose()
        $icon.Dispose()
      }
    } finally {
      [NativeIcon]::DestroyIcon($iconHandle) | Out-Null
      $bmp.Dispose()
    }
  } finally {
    Remove-Item $tempPng -ErrorAction SilentlyContinue
  }
}

$targets = @(
  @{ Path = "web/favicon.png"; Size = 16; Small = $true },
  @{ Path = "web/icons/Icon-192.png"; Size = 192 },
  @{ Path = "web/icons/Icon-512.png"; Size = 512 },
  @{ Path = "web/icons/Icon-maskable-192.png"; Size = 192; Maskable = $true },
  @{ Path = "web/icons/Icon-maskable-512.png"; Size = 512; Maskable = $true },
  @{ Path = "medq-web/public/icons/icon.png"; Size = 512 },
  @{ Path = "medq-web/public/icons/icon-192.png"; Size = 192 },
  @{ Path = "medq-web/public/icons/icon-512.png"; Size = 512 },
  @{ Path = "medq-web/src/app/icon.png"; Size = 512 },
  @{ Path = "medq-web/src/app/apple-icon.png"; Size = 180 },
  @{ Path = "android/app/src/main/res/mipmap-mdpi/ic_launcher.png"; Size = 48; Small = $true },
  @{ Path = "android/app/src/main/res/mipmap-hdpi/ic_launcher.png"; Size = 72; Small = $true },
  @{ Path = "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png"; Size = 96 },
  @{ Path = "android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png"; Size = 144 },
  @{ Path = "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"; Size = 192 }
)

foreach ($target in $targets) {
  Draw-MedQIcon -IconSize $target.Size -OutPath $target.Path -Maskable:([bool]$target.Maskable) -SmallMode:([bool]$target.Small)
  Write-Host "Wrote $($target.Path) [$($target.Size)x$($target.Size)]"
}

Write-FaviconIco -IconSize 64 -OutPath "medq-web/src/app/favicon.ico"
Write-Host "Wrote medq-web/src/app/favicon.ico"

Draw-MedQIcon -IconSize 1024 -OutPath "docs/branding/app-icon-master.png"
Write-Host "Wrote docs/branding/app-icon-master.png"
