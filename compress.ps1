Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\13268\Desktop\工作\Advices\background.png"
$destPath = "C:\Users\13268\Desktop\工作\Advices\background_optimized.jpg"

$img = [System.Drawing.Image]::FromFile($sourcePath)

# 计算缩小后的尺寸（宽度限制为1920px）
$maxWidth = 1920
$ratio = 1
if ($img.Width -gt $maxWidth) {
    $ratio = $maxWidth / $img.Width
}
$newWidth = [int]($img.Width * $ratio)
$newHeight = [int]($img.Height * $ratio)

# 创建缩小的图片
$bitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.DrawImage($img, 0, 0, $newWidth, $newHeight)

# 保存为JPEG
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageDecoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 80)

$bitmap.Save($destPath, $jpegCodec, $encoderParams)

# 清理
$img.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Done! Saved to $destPath"
