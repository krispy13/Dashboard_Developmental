"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Constraint {
    [key: string]: {
      lb: number;
      ub: number;
    };
  }

interface SubmitCardProps {
  onSubmit: (setPattern: { constraints: Constraint|null; law: string; threshold: number;}) => void;
  constraints: Constraint | null;
  law: string;
  threshold: number;
}

export default function UserSetPattern({ onSubmit, constraints, law, threshold = 0}: SubmitCardProps) {
  const [selectedConstraints, setSelectedConstraints] = useState<Constraint|null>(constraints);
  const [selectedLaw, setSelectedLaw] = useState<string>(law); // Default law

  const handleSubmit = () => {
    onSubmit({ constraints: selectedConstraints, law: selectedLaw , threshold: threshold});
  };

  useEffect(() => {
    setSelectedConstraints(constraints);
  }, [constraints]);

  useEffect(() => {
    setSelectedLaw(law);
  }, [law]);

  return (
    <Button onClick={handleSubmit} variant={"default"}>
      Run Analysis
    </Button>
  );
}
