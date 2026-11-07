import { NextResponse } from "next/server"
import { people, profiles } from "@/lib/model"

export async function POST(request: Request) {
  const { person, vector } = await request.json()

  if (typeof person !== "string" || !person.trim() || !Array.isArray(vector)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const name = person.trim()
  const existing = profiles.get(name) ?? []
  existing.push(vector)
  profiles.set(name, existing)

  return NextResponse.json({ person: name, swipes: existing.length, people: people() })
}

export async function GET() {
  return NextResponse.json({ people: people() })
}

export async function DELETE() {
  profiles.clear()
  return NextResponse.json({ people: [] })
}
