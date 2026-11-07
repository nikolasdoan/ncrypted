"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GestureCanvas, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/components/gesture-canvas"
import { extractFeatures, swipeVector, type GestureSample, type GestureFeatures } from "@/lib/features"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts"

const MIN_SWIPES = 10
/** Verify scores the last few swipes together; more swipes, surer answer. */
const WINDOW = 5

type Person = { person: string; swipes: number }
type Risk = "low" | "medium" | "high"

function riskOf(score: number): Risk {
  if (score >= 65) return "low"
  if (score >= 35) return "medium"
  return "high"
}

function velocitySeries(samples: GestureSample[]) {
  return samples.slice(1).map((s, i) => {
    const prev = samples[i]
    const dt = (s.timestamp - prev.timestamp) / 1000
    return { time: i, velocity: dt > 0 ? Math.hypot(s.x - prev.x, s.y - prev.y) / dt : 0 }
  })
}

export default function Home() {
  const [people, setPeople] = useState<Person[]>([])
  const [enrolName, setEnrolName] = useState("Owner")
  const [checkAs, setCheckAs] = useState<string | null>(null)
  const [recent, setRecent] = useState<number[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [velocityHistory, setVelocityHistory] = useState<{ time: number; velocity: number }[]>([])
  const [lastFeatures, setLastFeatures] = useState<GestureFeatures | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const ready = people.filter((p) => p.swipes >= MIN_SWIPES)
  const score = recent.length ? Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 100) : null
  const risk = score === null ? null : riskOf(score)

  const describe = useCallback((samples: GestureSample[]) => {
    setLastFeatures(extractFeatures(samples))
    setVelocityHistory(velocitySeries(samples))
    return swipeVector(samples, CANVAS_WIDTH, CANVAS_HEIGHT)
  }, [])

  const handleEnroll = useCallback(
    async (samples: GestureSample[]) => {
      setIsProcessing(true)
      setMessage(null)
      try {
        const res = await fetch("/api/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: enrolName, vector: describe(samples) }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setPeople(data.people)
        setMessage({ type: "success", text: `${data.person}: swipe ${data.swipes} enrolled` })
      } catch {
        setMessage({ type: "error", text: "Enrollment failed" })
      } finally {
        setIsProcessing(false)
      }
    },
    [enrolName, describe],
  )

  const handleVerify = useCallback(
    async (samples: GestureSample[]) => {
      if (!checkAs) return
      setIsProcessing(true)
      setMessage(null)
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: checkAs, vector: describe(samples) }),
        })
        const data = await res.json()
        if (!res.ok) {
          setMessage({ type: "error", text: data.error || "Verification failed" })
          return
        }
        setRecent((prev) => [...prev, data.probability].slice(-WINDOW))
      } catch {
        setMessage({ type: "error", text: "Verification failed" })
      } finally {
        setIsProcessing(false)
      }
    },
    [checkAs, describe],
  )

  const chooseCheckAs = (person: string) => {
    setCheckAs(person)
    setRecent([])
    setMessage(null)
  }

  const handleReset = async () => {
    await fetch("/api/enroll", { method: "DELETE" })
    setPeople([])
    setCheckAs(null)
    setRecent([])
    setVelocityHistory([])
    setLastFeatures(null)
    setMessage({ type: "success", text: "All profiles cleared" })
  }

  const radarData = lastFeatures
    ? [
        { feature: "Velocity", value: Math.min(lastFeatures.velocityMean / 10, 100), fullMark: 100 },
        { feature: "Consistency", value: Math.max(0, 100 - lastFeatures.velocityStd), fullMark: 100 },
        { feature: "Pressure", value: lastFeatures.pressureMean * 100, fullMark: 100 },
        { feature: "Curvature", value: Math.min(lastFeatures.curvatureMean * 50, 100), fullMark: 100 },
        { feature: "Duration", value: Math.min(lastFeatures.strokeDuration / 30, 100), fullMark: 100 },
      ]
    : []

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">nCrypted · Swipe Identity Demo</h1>
          <p className="text-muted-foreground">
            Analyze swipe gestures to create a unique behavioral profile
          </p>
        </div>

        <Tabs defaultValue="enroll" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="enroll">
              Enroll {people.length > 0 && <Badge variant="secondary" className="ml-2">{people.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="verify">Verify</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="enroll" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Enrollment</CardTitle>
                <CardDescription>
                  Each person swipes {MIN_SWIPES}+ times under their own name. Enrol at least two people: the model
                  learns the owner by telling them apart from someone else.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  Enrolling as
                  <input
                    value={enrolName}
                    onChange={(e) => setEnrolName(e.target.value)}
                    className="rounded-md border border-border bg-card px-3 py-1.5"
                  />
                </label>
                <GestureCanvas onGestureComplete={handleEnroll} disabled={isProcessing || !enrolName.trim()} />
                {message && (
                  <Alert variant={message.type === "error" ? "destructive" : "default"}>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}
                {people.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {people.map((p) => (
                      <Badge key={p.person} variant={p.swipes >= MIN_SWIPES ? "default" : "secondary"}>
                        {p.person}: {p.swipes}/{MIN_SWIPES}
                      </Badge>
                    ))}
                  </div>
                )}
                {ready.length >= 2 && (
                  <p className="text-sm text-green-600">Ready! Switch to the Verify tab.</p>
                )}
                {people.length > 0 && (
                  <Button variant="outline" onClick={handleReset}>
                    Clear all profiles
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verify" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Verification</CardTitle>
                <CardDescription>
                  Pick whose account this is, then swipe. The score combines your last {WINDOW} swipes.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                {ready.length < 2 ? (
                  <Alert>
                    <AlertDescription>
                      Enrol at least two people with {MIN_SWIPES}+ swipes each first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                      Account of
                      {ready.map((p) => (
                        <Button
                          key={p.person}
                          size="sm"
                          variant={checkAs === p.person ? "default" : "outline"}
                          onClick={() => chooseCheckAs(p.person)}
                        >
                          {p.person}
                        </Button>
                      ))}
                    </div>
                    <GestureCanvas onGestureComplete={handleVerify} disabled={isProcessing || !checkAs} />
                    {message && (
                      <Alert variant={message.type === "error" ? "destructive" : "default"}>
                        <AlertDescription>{message.text}</AlertDescription>
                      </Alert>
                    )}
                    {score !== null && risk && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl font-bold">{score}%</div>
                          <Badge
                            variant={risk === "low" ? "default" : risk === "medium" ? "secondary" : "destructive"}
                          >
                            {risk.toUpperCase()} RISK
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Match with {checkAs}’s swipe profile · based on {recent.length} swipe{recent.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Velocity Over Time</CardTitle>
                  <CardDescription>Swipe speed during last gesture</CardDescription>
                </CardHeader>
                <CardContent>
                  {velocityHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={velocityHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="velocity" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No data yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feature Profile</CardTitle>
                  <CardDescription>Behavioral characteristics</CardDescription>
                </CardHeader>
                <CardContent>
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="feature" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="Features" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No data yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {lastFeatures && (
              <Card>
                <CardHeader>
                  <CardTitle>Raw Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Velocity Mean:</span>{" "}
                      {lastFeatures.velocityMean.toFixed(2)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Velocity Std:</span>{" "}
                      {lastFeatures.velocityStd.toFixed(2)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pressure:</span>{" "}
                      {lastFeatures.pressureMean.toFixed(3)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{" "}
                      {lastFeatures.strokeDuration.toFixed(0)}ms
                    </div>
                    <div>
                      <span className="text-muted-foreground">Samples:</span> {lastFeatures.sampleCount}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Curvature:</span>{" "}
                      {lastFeatures.curvatureMean.toFixed(3)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
