$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Server running at http://localhost:8080/"

$root = $PSScriptRoot

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $localPath = Join-Path $root $path.TrimStart('/')

    if (Test-Path $localPath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($localPath)
        
        if ($localPath.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
        elseif ($localPath.EndsWith(".css")) { $response.ContentType = "text/css; charset=utf-8" }
        elseif ($localPath.EndsWith(".js")) { $response.ContentType = "application/javascript; charset=utf-8" }
        
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.Close()
}
