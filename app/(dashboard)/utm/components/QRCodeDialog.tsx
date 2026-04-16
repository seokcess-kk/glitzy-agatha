'use client'

import { useState, useRef } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  label?: string
}

export function QRCodeDialog({ open, onOpenChange, url, label }: QRCodeDialogProps) {
  const [size, setSize] = useState(200)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [fgColor, setFgColor] = useState('#000000')
  const canvasRef = useRef<HTMLDivElement>(null)

  // URL이 없으면 빈 다이얼로그 표시
  if (!url) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR 코드</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            URL을 먼저 생성해주세요.
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  function downloadPNG() {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `qr-${label || 'utm'}-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function downloadSVG() {
    const svg = canvasRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.download = `qr-${label || 'utm'}-${Date.now()}.svg`
    link.href = url
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR 코드</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* QR 코드 표시 */}
          <div
            ref={canvasRef}
            className="flex flex-col items-center justify-center gap-4 p-4 bg-white rounded-lg"
          >
            {/* SVG for display, Canvas for PNG download */}
            <QRCodeSVG
              value={url}
              size={size}
              bgColor={bgColor}
              fgColor={fgColor}
              level="M"
              includeMargin={true}
            />
            {/* Hidden canvas for PNG export */}
            <div style={{ display: 'none' }}>
              <QRCodeCanvas
                value={url}
                size={size * 2}
                bgColor={bgColor}
                fgColor={fgColor}
                level="M"
                includeMargin={true}
              />
            </div>
          </div>

          {/* URL 표시 */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">URL</p>
            <p className="text-xs text-foreground/80 break-all font-mono">{url}</p>
          </div>

          {/* 옵션 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">크기</label>
              <select
                value={size}
                onChange={e => setSize(Number(e.target.value))}
                className="w-full bg-card dark:bg-card border border-border rounded px-2 py-1.5 text-sm"
              >
                <option value={150}>작게 (150px)</option>
                <option value={200}>보통 (200px)</option>
                <option value={300}>크게 (300px)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">배경색</label>
              <input
                type="color"
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
                className="w-full h-9 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">코드색</label>
              <input
                type="color"
                value={fgColor}
                onChange={e => setFgColor(e.target.value)}
                className="w-full h-9 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* 다운로드 버튼 */}
          <div className="flex gap-2">
            <Button variant="glass" className="flex-1" onClick={downloadPNG}>
              <Download className="mr-2 h-4 w-4" />
              PNG 다운로드
            </Button>
            <Button variant="glass" className="flex-1" onClick={downloadSVG}>
              <Download className="mr-2 h-4 w-4" />
              SVG 다운로드
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
