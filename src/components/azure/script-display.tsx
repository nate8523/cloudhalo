'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, Download, Info } from 'lucide-react'

interface ScriptDisplayProps {
  script: string
  title?: string
  description?: string
  fileName?: string
}

export function ScriptDisplay({
  script,
  title = "PowerShell Script",
  description = "Run this script in Azure Cloud Shell or PowerShell",
  fileName = "cloudhalo-setup.ps1"
}: ScriptDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy script:', error)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([script], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Card variant="premium">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-warning/30 dark:border-warning/20 bg-warning/10 dark:bg-warning/5">
          <Info className="h-4 w-4 text-warning dark:text-warning" />
          <AlertDescription className="text-foreground/90 dark:text-foreground/80 text-sm">
            <strong>Recommended approach (avoids paste issues):</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1.5">
              <li><strong>Download</strong> the script using the Download button below</li>
              <li>Open <a href="https://shell.azure.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Azure Cloud Shell</a> (choose PowerShell mode)</li>
              <li>Click the <strong>Upload/Download</strong> icon (up arrow) in the Cloud Shell toolbar</li>
              <li>Upload the downloaded .ps1 file</li>
              <li>Run: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">pwsh ./cloudhalo-*.ps1</code></li>
              <li>Copy the output credentials and return here to paste them in Step 3</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              ⚠️ Cloud Shell often truncates long copy-paste operations. Downloading and uploading the file is more reliable.
            </p>
          </AlertDescription>
        </Alert>

        {/* Script Display */}
        <div className="relative group">
          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              className="shadow-md"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownload}
              className="shadow-md"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>

          <div className="relative">
            <pre className="bg-muted dark:bg-muted/50 p-4 rounded-lg border border-border dark:border-border/40 overflow-x-auto max-h-96 text-xs sm:text-sm font-mono">
              <code className="text-foreground/90 dark:text-foreground/80">
                {script}
              </code>
            </pre>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={handleDownload}
            className="flex-1"
            variant="default"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Script (Recommended)
          </Button>
          <Button
            onClick={handleCopy}
            className="flex-1"
            variant={copied ? "default" : "outline"}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied to Clipboard
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Script
              </>
            )}
          </Button>
        </div>
        <div className="flex justify-center pt-2">
          <Button
            onClick={() => window.open('https://shell.azure.com', '_blank')}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Open Azure Cloud Shell →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
