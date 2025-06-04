"use client"

import { Area, AreaChart, Legend, Tooltip, XAxis, YAxis, CartesianGrid} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"

// Generate sample data for the area chart
const generateAreaData = () => {
  const data = []
  for (let i = 0; i <= 250; i += 2) {
    // Simulate normal distributions for both groups
    const lawInactiveFreq = Math.floor(
      160 * Math.exp(-Math.pow(i - 62.224, 2) / (2 * Math.pow(25, 2)))
    )
    const lawActiveFreq = Math.floor(
      150 * Math.exp(-Math.pow(i - 43.428, 2) / (2 * Math.pow(20, 2)))
    )
    
    data.push({
      rate: i,
      lawInactive: lawInactiveFreq,
      lawActive: lawActiveFreq,
    })
  }
  return data
}

export default function TwoAreaChart() {
  return (
    <Card className="w-full mx-auto">
      <CardHeader>
        <CardTitle>Death Rate Differential by Pharmacist Dispensing Method</CardTitle>
        <CardDescription>
          Standing Order (Law) Status Comparison - Area Chart
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ChartContainer
            config={{
              lawInactive: {
                label: "Law Inactive",
                color: "hsl(217 91% 60% / 70%)",
              },
              lawActive: {
                label: "Law Active",
                color: "hsl(0 100% 50% / 100%)",
              },
            }}
            className="h-[400px] w-full"
          >
            <AreaChart
              data={generateAreaData()}
              margin={{ top: 20, right: 30, bottom: 50, left: 40 }}
            >
              <CartesianGrid vertical={false} />
              <defs>
                <linearGradient id="colorLawInactive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorLawActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0 100% 50%)" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="hsl(0 100% 50%)" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <XAxis
                dataKey="rate"
                label={{ value: "Death Rate", position: "bottom", offset: -7 }}
                tickFormatter={(value) => `${value}`}
              />
              <YAxis
                label={{ value: "Frequency", angle: -90, position: "insideLeft", offset: 10 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Death Rate
                            </span>
                            <span className="font-bold">
                              {payload[0].payload.rate}
                            </span>
                          </div>
                          {payload.map((p) => (
                            <div key={p.name} className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                {p.name === "lawActive" ? "Law Active" : "Law Inactive"}
                              </span>
                              <span className="font-bold">{p.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
              />
              <Area
                type="monotone"
                dataKey="lawInactive"
                stroke="hsl(217 91% 60%)"
                fillOpacity={1}
                fill="url(#colorLawInactive)"
                name="Law Inactive"
              />
              <Area
                type="monotone"
                dataKey="lawActive"
                stroke="hsl(0 100% 50%)"
                fillOpacity={1}
                fill="url(#colorLawActive)"
                name="Law Active"
              />
            </AreaChart>
          </ChartContainer>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Statistical Information:</p>
            <p>Inactive Mean: 62.224</p>
            <p>Active Mean: 43.428</p>
            <p>Paired t P-value: 0.0000</p>
            <p>Mann-Whitney P-value: 0.0000</p>
            <p>Avg ITE: -18.80 Stdev ITE:15.80</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}