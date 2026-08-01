"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Types for saved recommendation
interface SavedRecommendation {
  result: any; // structure as returned by API
  meta: any; // includes color and bgColor strings
}

export default function CompareRecommendationsPage() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedRecommendation[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Load saved recommendations from localStorage on mount
  useEffect(() => {
    const data = localStorage.getItem("savedRecommendations");
    if (data) {
      try {
        setSaved(JSON.parse(data));
      } catch (e) {
        console.error("Failed to parse saved recommendations");
        setSaved([]);
      }
    }
  }, []);

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= 2) return prev; // max two selections
      return [...prev, index];
    });
  };

  const selected = selectedIndices.map((i) => saved[i]);

  // Fields to compare
  const fields = [
    { key: "crop", label: "Crop" },
    { key: "confidence", label: "Confidence", format: (v: number) => `${v}%` },
    { key: "alternatives", label: "Alternatives" },
  ];

  const differingFields = fields.filter((f) => {
    const values = selected.map((item) => {
      const val = (item.result as any)[f.key];
      if (f.key === "alternatives") {
        return JSON.stringify(val || []);
      }
      return String(val ?? "");
    });
    return new Set(values).size > 1;
  });

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-left">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Compare Recommendations
            </h1>
            <p className="text-sm text-muted-foreground">
              Select up to two saved results to compare side‑by‑side.
            </p>
          </div>
        </div>

        {/* List of saved results */}
        {saved.length === 0 && (
          <p className="text-center text-muted-foreground">
            No saved results. Save a recommendation from the recommendation page
            first.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {saved.map((item, idx) => (
            <Card key={idx} className="border border-border bg-card">
              <CardHeader className="border-b border-border/40 pb-3 flex flex-col">
                <CardTitle className="text-lg font-semibold flex items-center justify-between">
                  Saved #{idx + 1}
                  <Button
                    variant={
                      selectedIndices.includes(idx) ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => toggleSelect(idx)}
                  >
                    {selectedIndices.includes(idx) ? "Selected" : "Select"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="font-medium">Crop: {item.result.crop}</p>
                <p>Confidence: {item.result.confidence}%</p>
                {item.result.alternatives?.length > 0 && (
                  <p>
                    Alternatives:{" "}
                    {item.result.alternatives
                      .map((a: any) => a.crop)
                      .join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison table */}
        {selected.length === 2 && (
          <Card className="border border-border bg-card overflow-hidden mt-8">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <span>Comparison Matrix</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="w-full min-w-[400px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                      <TableHead className="py-4 px-6 font-semibold text-foreground text-left w-48">
                        Field
                      </TableHead>
                      {selected.map((_, i) => (
                        <TableHead
                          key={i}
                          className="py-4 px-6 font-semibold text-foreground text-center"
                        >
                          <span className="font-mono text-sm bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
                            Result {i + 1}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((f) => {
                      const isDifferent = differingFields.includes(f);
                      return (
                        <TableRow
                          key={f.key}
                          className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${isDifferent ? "bg-amber-500/5 dark:bg-amber-500/10" : ""}`}
                        >
                          <TableCell className="py-4 px-6 font-medium text-foreground text-left">
                            <div className="flex items-center gap-1.5">
                              <span>{f.label}</span>
                              {isDifferent && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                                  differs
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {selected.map((item, i) => {
                            const raw = (item.result as any)[f.key];
                            let display: any = raw;
                            if (f.key === "alternatives") {
                              display =
                                raw?.map((a: any) => a.crop).join(", ") ||
                                "None";
                            } else if (f.format) {
                              display = f.format(raw);
                            }
                            return (
                              <TableCell
                                key={i}
                                className="py-4 px-6 text-center"
                              >
                                <span className="text-sm font-medium text-foreground">
                                  {display}
                                </span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {selected.length > 0 && selected.length < 2 && (
          <p className="text-center text-muted-foreground mt-4">
            Select another saved result to compare.
          </p>
        )}
      </div>
    </>
  );
}
