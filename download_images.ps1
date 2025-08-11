$baseUrl = "http://gakuin.gakken.jp/lp01"
$images = @(
    "img/mv_person01.webp",
    "img/mv_person02.webp",
    "img/mv_person03.webp", 
    "img/mv_person04.webp",
    "img/mv_person05.webp",
    "img/mv_person06.webp",
    "img/mv_person07.webp",
    "img/mv_person08.webp",
    "img/mv_person09.webp",
    "img/mv_person01@sp.webp",
    "img/mv_person02@sp.webp",
    "img/mv_person03@sp.webp",
    "img/mv_person04@sp.webp",
    "img/mv_person05@sp.webp",
    "img/mv_person06@sp.webp",
    "img/mv_person07@sp.webp",
    "img/mv_person08@sp.webp",
    "img/mv_person09@sp.webp",
    "img/mv_title.webp",
    "img/mv_label.svg",
    "img/text_mask.svg",
    "img/icon_gakken.webp",
    "img/icon_clark.webp",
    "img/text_point.svg",
    "img/img_searchcampus.webp",
    "img/point01_person.webp",
    "img/point01_person@sp.webp",
    "img/point01_img01.webp",
    "img/point01_img01@sp.webp",
    "img/point02_person.webp",
    "img/point02_person@sp.webp",
    "img/point02_piegraph01.webp",
    "img/point02_piegraph01@sp.webp",
    "img/point02_piegraph02.webp",
    "img/point02_piegraph02@sp.webp",
    "img/point03_person.webp",
    "img/point03_person@sp.webp",
    "img/img_reason01.webp",
    "img/img_reason01@sp.webp",
    "img/img_reason02.webp",
    "img/img_reason02@sp.webp",
    "img/img_reason03.webp",
    "img/img_reason03@sp.webp",
    "img/point04_person.webp",
    "img/point04_person@sp.webp",
    "img/point04_piegraph.webp",
    "img/point04_piegraph@sp.webp",
    "img/icon_voice01.svg",
    "img/icon_voice02.svg",
    "img/icon_voice03.svg"
)

foreach ($image in $images) {
    $url = "$baseUrl/$image"
    $outputPath = $image
    $dir = Split-Path $outputPath -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Write-Host "Downloading $url to $outputPath"
    try {
        Invoke-WebRequest -Uri $url -OutFile $outputPath
        Write-Host "Successfully downloaded $image"
    }
    catch {
        Write-Host "Failed to download $image : $_"
    }
}
