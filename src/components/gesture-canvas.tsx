"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import type { GestureSample } from "@/lib/features"

interface GestureCanvasProps {
  onGestureComplete: (samples: GestureSample[]) => void
  disabled?: boolean
}

export function GestureCanvas({ onGestureComplete, disabled }: GestureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [samples, setSamples] = useState<GestureSample[]>([])
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctxRef.current = ctx
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    clearCanvas()
    setIsDrawing(true)
    const { x, y } = getCoords(e)
    const sample: GestureSample = {
      x,
      y,
      pressure: e.pressure || 0.5,
      timestamp: e.timeStamp,
      width: e.width || 1,
      height: e.height || 1,
    }
    setSamples([sample])
    ctxRef.current?.beginPath()
    ctxRef.current?.moveTo(x, y)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return
    const { x, y } = getCoords(e)
    const sample: GestureSample = {
      x,
      y,
      pressure: e.pressure || 0.5,
      timestamp: e.timeStamp,
      width: e.width || 1,
      height: e.height || 1,
    }
    setSamples((prev) => [...prev, sample])
    ctxRef.current?.lineTo(x, y)
    ctxRef.current?.stroke()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (canvas) canvas.releasePointerCapture(e.pointerId)
    setIsDrawing(false)
    if (samples.length > 5) {
      onGestureComplete(samples)
    }
    setSamples([])
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className={`border border-border rounded-lg bg-card touch-none ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-crosshair"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <p className="text-xs text-muted-foreground mt-2 text-center">
        {disabled ? "Processing..." : "Draw a pattern on the canvas"}
      </p>
    </div>
  )
}
