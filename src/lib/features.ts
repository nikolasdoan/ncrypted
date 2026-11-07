export interface GestureSample {
  x: number
  y: number
  pressure: number
  timestamp: number
  width: number
  height: number
}

export interface GestureFeatures {
  velocityMean: number
  velocityStd: number
  accelerationMean: number
  pressureMean: number
  pressureStd: number
  strokeDuration: number
  sampleCount: number
  curvatureMean: number
  touchAreaMean: number
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length
  return Math.sqrt(variance)
}

export function extractFeatures(samples: GestureSample[]): GestureFeatures {
  if (samples.length < 2) {
    return {
      velocityMean: 0,
      velocityStd: 0,
      accelerationMean: 0,
      pressureMean: 0,
      pressureStd: 0,
      strokeDuration: 0,
      sampleCount: samples.length,
      curvatureMean: 0,
      touchAreaMean: 0,
    }
  }

  const velocities: number[] = []
  const accelerations: number[] = []
  const curvatures: number[] = []
  const pressures = samples.map((s) => s.pressure)
  const touchAreas = samples.map((s) => s.width * s.height)

  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x
    const dy = samples[i].y - samples[i - 1].y
    const dt = (samples[i].timestamp - samples[i - 1].timestamp) / 1000

    if (dt > 0) {
      const velocity = Math.sqrt(dx * dx + dy * dy) / dt
      velocities.push(velocity)

      if (velocities.length > 1) {
        const prevVelocity = velocities[velocities.length - 2]
        accelerations.push((velocity - prevVelocity) / dt)
      }
    }

    if (i > 1) {
      const prev2 = samples[i - 2]
      const prev1 = samples[i - 1]
      const curr = samples[i]
      const v1x = prev1.x - prev2.x
      const v1y = prev1.y - prev2.y
      const v2x = curr.x - prev1.x
      const v2y = curr.y - prev1.y
      const cross = v1x * v2y - v1y * v2x
      const dot = v1x * v2x + v1y * v2y
      const angle = Math.abs(Math.atan2(cross, dot))
      curvatures.push(angle)
    }
  }

  const strokeDuration = samples[samples.length - 1].timestamp - samples[0].timestamp

  return {
    velocityMean: mean(velocities),
    velocityStd: std(velocities),
    accelerationMean: mean(accelerations),
    pressureMean: mean(pressures),
    pressureStd: std(pressures),
    strokeDuration,
    sampleCount: samples.length,
    curvatureMean: mean(curvatures),
    touchAreaMean: mean(touchAreas),
  }
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * The 20 numbers the model sees for one swipe. Same features, in the same
 * order, as eval/evaluate_rf.py, which measured the accuracy in the deck.
 * Positions are fractions of the canvas, so they mean the same at any size.
 */
export function swipeVector(samples: GestureSample[], canvasWidth: number, canvasHeight: number): number[] {
  const s = samples
  const n = s.length
  const x = s.map((p) => p.x)
  const y = s.map((p) => p.y)
  const steps: number[] = []
  const vel: number[] = []
  for (let i = 1; i < n; i++) {
    const step = Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1])
    steps.push(step)
    const dt = (s[i].timestamp - s[i - 1].timestamp) / 1000
    if (dt > 0) vel.push(step / dt)
  }
  if (vel.length === 0) vel.push(0)
  const L = steps.reduce((a, b) => a + b, 0)
  const D = Math.hypot(x[n - 1] - x[0], y[n - 1] - y[0])
  const dur = Math.max(s[n - 1].timestamp - s[0].timestamp, 1)
  // distance of each point from the straight line start -> end
  const dev =
    D > 0
      ? x.map((_, i) => Math.abs((x[n - 1] - x[0]) * (y[0] - y[i]) - (x[0] - x[i]) * (y[n - 1] - y[0])) / D)
      : [0]
  const sortedVel = [...vel].sort((a, b) => a - b)
  const mid = Math.floor(n / 2)
  const pressures = s.map((p) => p.pressure)
  const areas = s.map((p) => p.width * p.height)
  return [
    x[0] / canvasWidth,
    y[0] / canvasHeight,
    x[n - 1] / canvasWidth,
    y[n - 1] / canvasHeight,
    Math.log(dur),
    Math.log(L + 1),
    L ? D / L : 1,
    Math.atan2(y[n - 1] - y[0], x[n - 1] - x[0]),
    percentile(sortedVel, 0.2),
    percentile(sortedVel, 0.5),
    percentile(sortedVel, 0.8),
    mean(vel.slice(0, 3)),
    mean(vel.slice(-3)),
    Math.max(...dev),
    mean(dev),
    pressures[mid],
    mean(pressures),
    areas[mid],
    mean(areas),
    n,
  ]
}
