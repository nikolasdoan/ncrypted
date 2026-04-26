"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GestureCanvas } from "@/components/gesture-canvas"
import { extractFeatures, featuresToVector, type GestureSample, type GestureFeatures } from "@/lib/features"
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

const USER_ID = "demo-user"

interface VerifyResult {
  score: number
  risk: "low" | "medium" | "high"
  baseline: number[]
  current: number[]
}

export default function Home() {
  const [enrollmentCount, setEnrollmentCount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [velocityHistory, setVelocityHistory] = useState<{ time: number; velocity: number }[]>([])
  const [lastFeatures, setLastFeatures] = useState<GestureFeatures | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleEnroll = useCallback(async (samples: GestureSample[]) => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const features = extractFeatures(samples)
      setLastFeatures(features)
      const vector = featuresToVector(features)

      const velocities = samples.slice(1).map((s, i) => {
        const prev = samples[i]
        const dx = s.x - prev.x
        const dy = s.y - prev.y
        const dt = (s.timestamp - prev.timestamp) / 1000
        return { time: i, velocity: dt > 0 ? Math.sqrt(dx * dx + dy * dy) / dt : 0 }
      })
      setVelocityHistory(velocities)

      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, vector }),
      })
      const data = await res.json()
      setEnrollmentCount(data.samplesCollected)
      setMessage({ type: "success", text: `Sample ${data.samplesCollected} enrolled successfully` })
    } catch {
      setMessage({ type: "error", text: "Enrollment failed" })
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleVerify = useCallback(async (samples: GestureSample[]) => {
    setIsProcessing(true)
    setMessage(null)
    try {
      const features = extractFeatures(samples)
      setLastFeatures(features)
      const vector = featuresToVector(features)

      const velocities = samples.slice(1).map((s, i) => {
        const prev = samples[i]
        const dx = s.x - prev.x
        const dy = s.y - prev.y
        const dt = (s.timestamp - prev.timestamp) / 1000
        return { time: i, velocity: dt > 0 ? Math.sqrt(dx * dx + dy * dy) / dt : 0 }
      })
      setVelocityHistory(velocities)

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, vector }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessage({ type: "error", text: err.error || "Verification failed" })
        return
      }

      const data: VerifyResult = await res.json()
      setVerifyResult(data)
      setMessage({
        type: data.risk === "high" ? "error" : "success",
        text: `Score: ${data.score}% — Risk: ${data.risk.toUpperCase()}`,
      })
    } catch {
      setMessage({ type: "error", text: "Verification failed" })
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleReset = async () => {
    await fetch(`/api/enroll?userId=${USER_ID}`, { method: "DELETE" })
    setEnrollmentCount(0)
    setVerifyResult(null)
    setVelocityHistory([])
    setLastFeatures(null)
    setMessage({ type: "success", text: "Profile cleared" })
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
          <h1 className="text-3xl font-bold">Behavioral Biometrics KYC Demo</h1>
          <p className="text-muted-foreground">
            Analyze swipe gestures to create a unique behavioral profile
          </p>
        </div>

        <Tabs defaultValue="enroll" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="enroll">
              Enroll {enrollmentCount > 0 && <Badge variant="secondary" className="ml-2">{enrollmentCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="verify">Verify</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="enroll" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Enrollment</CardTitle>
                <CardDescription>
                  Draw 3+ patterns to build your behavioral profile. Each pattern captures your unique gesture dynamics.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <GestureCanvas onGestureComplete={handleEnroll} disabled={isProcessing} />
                {message && (
                  <Alert variant={message.type === "error" ? "destructive" : "default"}>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}
                {enrollmentCount >= 3 && (
                  <p className="text-sm text-green-600">Profile ready! Switch to Verify tab to test.</p>
                )}
                {enrollmentCount > 0 && (
                  <Button variant="outline" onClick={handleReset}>
                    Clear Profile
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
                  Draw a pattern to verify against your enrolled profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                {enrollmentCount < 3 ? (
                  <Alert>
                    <AlertDescription>
                      Please enroll at least 3 samples first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <GestureCanvas onGestureComplete={handleVerify} disabled={isProcessing} />
                    {message && (
                      <Alert variant={message.type === "error" ? "destructive" : "default"}>
                        <AlertDescription>{message.text}</AlertDescription>
                      </Alert>
                    )}
                    {verifyResult && (
                      <div className="flex items-center gap-4">
                        <div className="text-4xl font-bold">{verifyResult.score}%</div>
                        <Badge
                          variant={
                            verifyResult.risk === "low"
                              ? "default"
                              : verifyResult.risk === "medium"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {verifyResult.risk.toUpperCase()} RISK
                        </Badge>
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
