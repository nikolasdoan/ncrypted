import { NextResponse } from "next/server"
import { ownerProbability } from "@/lib/model"

export async function POST(request: Request) {
  const { person, vector } = await request.json()

  if (typeof person !== "string" || !Array.isArray(vector)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = ownerProbability(person, [vector])
  if (typeof result === "string") {
    return NextResponse.json({ error: result }, { status: 409 })
  }
  return NextResponse.json({ probability: result[0] })
}
