"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, BarChart, ChevronLeft, Loader2 } from 'lucide-react';
import FeatureImportanceChart from "@/components/feature-importance-chart";

interface StatisticalInfo {
  inactiveMean: number;
  activeMean: number;
  pairedTPValue: number;
  mannWhitneyPValue: number;
  avgITE: number;
  stdevITE: number;
  imbalanceRatio: number;
  cohensD: number;
}

interface MetricCardProps {
  statInfo: StatisticalInfo | null;
  kFoldScore: number | null;
  className?: string;
  isLoading: boolean;
  featureImportance?: {
    features: string[];
    importance: number[];
  } | null;
  columnHistograms?: {
    [key: string]: {
      counts: number[];
      bin_edges: number[];
    }
  } | null;
  fullColumnHistograms?: {
    [key: string]: {
      counts: number[];
      bin_edges: number[];
    }
  } | null;
  onViewChange?: (isShowingFeatureImportance: boolean) => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  statInfo, 
  kFoldScore, 
  className, 
  isLoading,
  featureImportance = null,
  columnHistograms = null,
  fullColumnHistograms,
  onViewChange
}) => {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [showFeatureImportance, setShowFeatureImportance] = useState(false);

  const toggleAccordion = (value: string) => {
    setOpenItems((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const toggleView = () => {
    const newValue = !showFeatureImportance;
    setShowFeatureImportance(newValue);
    // Notify parent component of view change
    if (onViewChange) {
      onViewChange(newValue);
    }
  };

  // Metrics - Explanations
  const metricsExplanations: { [key: string]: string } = {
    "inactive-mean": "The mean value of the inactive data points.",
    "active-mean": "The mean value of the active data points.",
    "paired-t-p-value": "The p-value from the paired t-test, indicating statistical significance between two groups.",
    "mann-whitney-p-value": "The p-value from the Mann-Whitney U test, indicating statistical significance between two groups.",
    "avg-ite": "The average Individual Treatment Effect (ITE), representing the mean difference in outcomes between treated and untreated groups.",
    "stdev-ite": "The standard deviation of Individual Treatment Effect (ITE), measuring the variability of treatment effects across the population.",
    "imbalance-ratio": "The ratio of the largest to the smallest class size in a dataset, indicating data imbalance.",
    "cohens-d": "A standardized measure of effect size that quantifies the difference between two group means.",
    "k-fold": "The average RMSE across K-folds, normalized by the range of target values, indicating model performance"
  };

  //  Constraints for Tests to Pass
  const passingConstraints: { [key: string]: (value: number) => boolean } = {
    "paired-t-p-value": (value) => value < 0.05,
    "mann-whitney-p-value": (value) => value < 0.05,
    // "avg-ite": (value) => Math.abs(value) > 0, 
    // "stdev-ite": (value) => value > 0, 
    "imbalance-ratio": (value) => value <= 10,
    "cohens-d": (value) => Math.abs(value) >= 0.2,
    "k-fold": (value) => value <= 0.2 && value >= 0.1
  };

  const renderStatRow = (label: string, value: number | string, showTick: boolean = false, id: string, isPassing: boolean = false) => (
    <AccordionItem value={id}>
      <AccordionTrigger onClick={() => toggleAccordion(id)} className="hover:no-underline">
        <div className="flex justify-between w-full">
          <span>{label}</span>
          <span className="flex items-center">
            {showTick && (isPassing ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
            ))}
            {value}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <p className="text-sm text-muted-foreground">
          {metricsExplanations[id]}
        </p>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <Card className={className}>
      <CardHeader className="relative pb-2">
        <div className="absolute top-4 right-4 z-10">
          <Button
            onClick={toggleView}
            title={showFeatureImportance ? "Show Statistics" : "Show Feature of Importance"}
          >
            {showFeatureImportance ? 
                <>
                <ChevronLeft className="h-4 w-4"/>
                Show Statistics
                </>
              : 
              <>
                <BarChart className="h-4 w-4" />
                  Show Feature Importance
              </>
            }
          </Button>
        </div>
        <CardTitle>
          {showFeatureImportance ? "Feature of Importance" : "Statistical Information"}
        </CardTitle>
        <CardDescription>
          {showFeatureImportance 
            ? "Features most predictive of treatment effect" 
            : "Key metrics derived from the histogram data"
          }
        </CardDescription>
      </CardHeader>
      <div className="relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : null}
        <CardContent>
          {showFeatureImportance ? (
            <FeatureImportanceChart 
              featureData={featureImportance}
              columnHistograms={columnHistograms}
              fullColumnHistograms={fullColumnHistograms}
              isLoading={isLoading}
              className="h-[33vh] overflow-y-scroll"
            />
          ) : (
            statInfo ? (
              <Accordion type="multiple" value={openItems} className="w-full">
                {renderStatRow(
                  "Imbalance Ratio",
                  (statInfo.imbalanceRatio.toFixed(2)),
                  true,
                  "imbalance-ratio",
                  passingConstraints["imbalance-ratio"](statInfo.imbalanceRatio)
                )}
                {renderStatRow(
                  "Paired t P-value",
                  statInfo.pairedTPValue < 1e-4
                    ? statInfo.pairedTPValue.toExponential(4)
                    : statInfo.pairedTPValue.toFixed(4),
                  true,
                  "paired-t-p-value",
                  passingConstraints["paired-t-p-value"](statInfo.pairedTPValue)
                )}
                {renderStatRow(
                  "Mann-Whitney P-value",
                  statInfo.mannWhitneyPValue < 1e-4
                    ? statInfo.mannWhitneyPValue.toExponential(4)
                    : statInfo.mannWhitneyPValue.toFixed(4),
                  true,
                  "mann-whitney-p-value",
                  passingConstraints["mann-whitney-p-value"](statInfo.mannWhitneyPValue)
                )}
                {renderStatRow(
                  "Cohen's D Test",
                  Math.abs(statInfo.cohensD).toFixed(2),
                  true,
                  "cohens-d",
                  passingConstraints["cohens-d"](statInfo.cohensD)
                )}
                {renderStatRow("Avg. ITE", statInfo.avgITE.toFixed(2), false, "avg-ite")}
                {renderStatRow("Std. Dev. ITE", statInfo.stdevITE.toFixed(2), false, "stdev-ite")}
                {kFoldScore !== null ? (
                  renderStatRow(
                    "K-Fold Cross Validation NRMSE",
                    kFoldScore.toFixed(2),
                    true, "k-fold",
                    passingConstraints["k-fold"](kFoldScore)
                  )
                ) : (
                  <div className="flex justify-center items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </Accordion>
            ) : (
              <p>No statistical data available.</p>
            )
          )}
        </CardContent>
      </div>
    </Card>
  );
};

export default MetricCard;