# Original geometric pin/meeting mark. Uses Windows' built-in drawing library; no downloaded artwork.
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../public/icons'
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
foreach ($variant in @(@{ Name='icon-192.png'; Size=192 }, @{ Name='icon-512.png'; Size=512 }, @{ Name='maskable-512.png'; Size=512 })) {
    $bitmap = New-Object System.Drawing.Bitmap($variant.Size, $variant.Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#ff385c'))
    $graphics.ScaleTransform($variant.Size / 512.0, $variant.Size / 512.0)
    $cream = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#fffaf7'))
    $pink = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ff385c'))
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddBezier(256,382,226,348,148,277,148,216)
    $path.AddBezier(148,216,148,72,364,72,364,216)
    $path.AddBezier(364,216,364,277,286,348,256,382)
    $path.CloseFigure()
    $graphics.FillPath($cream, $path)
    $graphics.FillEllipse($pink,209,192,38,38)
    $graphics.FillEllipse($pink,265,192,38,38)
    $smile = New-Object System.Drawing.Pen($pink,15)
    $smile.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $smile.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawBezier($smile,219,255,244,279,268,279,293,255)
    $bitmap.Save((Join-Path $iconDirectory $variant.Name), [System.Drawing.Imaging.ImageFormat]::Png)
    $smile.Dispose(); $path.Dispose(); $cream.Dispose(); $pink.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
