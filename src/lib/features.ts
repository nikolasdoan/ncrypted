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

export function featuresToVector(features: GestureFeatures): number[] {
  return [
    features.velocityMean,
    features.velocityStd,
    features.accelerationMean,
    features.pressureMean,
    features.pressureStd,
    features.strokeDuration / 1000,
    features.sampleCount / 100,
    features.curvatureMean,
    features.touchAreaMean,
  ]
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dotProduct / denom
}

export function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return []
  const result = new Array(vectors[0].length).fill(0)
  for (const vec of vectors) {
    for (let i = 0; i < vec.length; i++) {
      result[i] += vec[i]
    }
  }
  return result.map((v) => v / vectors.length)
}
