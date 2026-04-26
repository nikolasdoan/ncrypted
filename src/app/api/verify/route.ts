import { NextResponse } from "next/server"
import { cosineSimilarity, averageVectors } from "@/lib/features"
import { profiles } from "../enroll/route"

export async function POST(request: Request) {
  const { userId, vector } = await request.json()

  if (!userId || !vector || !Array.isArray(vector)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const enrolledVectors = profiles.get(userId)
  if (!enrolledVectors || enrolledVectors.length === 0) {
    return NextResponse.json({ error: "User not enrolled" }, { status: 404 })
  }

  const baseline = averageVectors(enrolledVectors)
  const similarity = cosineSimilarity(baseline, vector)
  const score = Math.max(0, Math.min(100, similarity * 100))

  let risk: "low" | "medium" | "high"
  if (score >= 75) {
    risk = "low"
  } else if (score >= 50) {
    risk = "medium"
  } else {
    risk = "high"
  }

  return NextResponse.json({
    score: Math.round(score * 10) / 10,
    risk,
    baseline: baseline.slice(0, 4),
    current: vector.slice(0, 4),
  })
}
