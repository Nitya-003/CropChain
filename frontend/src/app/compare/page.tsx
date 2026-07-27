"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { realCropBatchService } from "@/services/realCropBatchService";
import Header from "@/components/Header";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Batch {
  batchId: string;
  cropType: string;
  quantity: number;
  harvestDate: string;
  origin: string;
  farmerName: string;
  farmerAddress: string;
  currentStage: string;
  certifications?: string;
  description?: string;
  createdAt: string;
  updates: Array<{
    stage: string;
    actor: string;
    location: string;
    timestamp: string;
    notes?: string;
  }>;
  qrCode: string;
  blockchainHash?: string;
  isSpoiled?: boolean;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = searchParams.get("ids")?.split(",").filter(Boolean) || [];
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!ids.length) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const res = await realCropBatchService.getBatch(id);
              // getBatch returns BatchData directly
              const unpacked = res;
              if (unpacked && unpacked.batchId) {
                return unpacked as Batch;
              }
              return null;
            } catch (err) {
              console.error(`Error fetching batch ${id}:`, err);
              return null;
            }
          }),
        );
        const validBatches = results.filter((b): b is Batch => b !== null);
        if (validBatches.length === 0) {
          setError("No valid batches could be loaded for comparison.");
        } else {
          setBatches(validBatches);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load batches.");
      } finally {
        setLoading(false);
      }
    };

    fetchBatches();
  }, [searchParams]);

  const getStageColor = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case "farmer":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/30";
      case "mandi":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30";
      case "transport":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/30";
      case "retailer":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-700/30";
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="max-w-7xl mx-auto p-6 space-y-8 animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-6"></div>
          <div className="h-64 bg-muted rounded-xl"></div>
        </div>
      </>
    );
  }

  if (error || !ids.length || batches.length === 0) {
    return (
      <>
        <Header />
        <div className="max-w-4xl mx-auto p-6 text-center space-y-4 py-12">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            {error || "No batches selected for comparison"}
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Please select at least 2 batches from the Admin Dashboard to compare
            their parameters.
          </p>
          <Button onClick={() => router.push("/admin")} className="mt-4">
            Go to Admin Dashboard
          </Button>
        </div>
      </>
    );
  }

  const fields = [
    { key: "batchId", label: "Batch ID" },
    { key: "cropType", label: "Crop Type" },
    {
      key: "quantity",
      label: "Quantity",
      format: (v: any) => `${Number(v).toLocaleString()} kg`,
    },
    { key: "harvestDate", label: "Harvest Date" },
    { key: "origin", label: "Origin" },
    { key: "farmerName", label: "Farmer" },
    { key: "currentStage", label: "Current Stage", badge: true },
    {
      key: "status",
      label: "Status",
      badge: true,
      getVal: (b: Batch) => (b.isSpoiled ? "Spoiled" : "Active"),
    },
    {
      key: "certifications",
      label: "Certifications",
      format: (v: any) => v || "None",
    },
    {
      key: "description",
      label: "Description",
      format: (v: any) => v || "No description provided",
    },
  ];

  // Detect differing fields
  const differingFields = fields.filter((f) => {
    const values = batches.map((b) => {
      const val = f.getVal ? f.getVal(b) : b[f.key as keyof Batch];
      return String(val || "");
    });
    return new Set(values).size > 1;
  });

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Back navigation & title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-left">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Batch Comparison
            </h1>
            <p className="text-sm text-muted-foreground">
              Comparing side-by-side details for {batches.length} selected
              batches
            </p>
          </div>
        </div>

        <Card className="border border-border bg-card overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>Comparison Matrix</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[600px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left w-48">
                      Field
                    </TableHead>
                    {batches.map((b) => (
                      <TableHead
                        key={b.batchId}
                        className="py-4 px-6 font-semibold text-foreground text-center"
                      >
                        <span className="font-mono text-sm bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
                          {b.batchId}
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
                        {batches.map((b) => {
                          const rawValue = f.getVal
                            ? f.getVal(b)
                            : b[f.key as keyof Batch];
                          return (
                            <TableCell
                              key={b.batchId}
                              className="py-4 px-6 text-center"
                            >
                              {f.badge ? (
                                f.key === "status" ? (
                                  rawValue === "Spoiled" ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-300/30 capitalize font-semibold"
                                    >
                                      Spoiled
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/30 capitalize font-semibold"
                                    >
                                      Active
                                    </Badge>
                                  )
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className={`capitalize font-semibold border ${getStageColor(String(rawValue))}`}
                                  >
                                    {String(rawValue)}
                                  </Badge>
                                )
                              ) : f.format ? (
                                <span className="text-sm font-medium text-foreground">
                                  {f.format(rawValue as any)}
                                </span>
                              ) : (
                                <span className="text-sm font-medium text-foreground">
                                  {String(rawValue || "N/A")}
                                </span>
                              )}
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
      </div>
    </>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <div className="max-w-7xl mx-auto p-6 space-y-8 animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-6"></div>
            <div className="h-64 bg-muted rounded-xl"></div>
          </div>
        </>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
