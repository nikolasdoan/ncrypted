import { NextResponse } from "next/server"

const profiles = new Map<string, number[][]>()

export async function POST(request: Request) {
  const { userId, vector } = await request.json()

  if (!userId || !vector || !Array.isArray(vector)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const existing = profiles.get(userId) || []
  existing.push(vector)
  profiles.set(userId, existing)

  return NextResponse.json({
    status: "enrolled",
    samplesCollected: existing.length,
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const vectors = profiles.get(userId)
  if (!vectors || vectors.length === 0) {
    return NextResponse.json({ enrolled: false, samples: 0 })
  }

  return NextResponse.json({ enrolled: true, samples: vectors.length })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  profiles.delete(userId)
  return NextResponse.json({ status: "cleared" })
}

export { profiles }
