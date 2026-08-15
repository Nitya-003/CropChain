"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Vote, Shield, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface Proposal {
  id: string;
  title: string;
  category: string;
  proposer: string;
  forVotes: number;
  againstVotes: number;
  quorum: number;
  status: "Active" | "Succeeded" | "Defeated" | "Executed";
  endsIn: string;
}

export default function MandiDAOGovernancePage() {
  const [proposals] = useState<Proposal[]>([
    {
      id: "PROP-MNDI-101",
      title: "Cold-Chain Dispute #402: Transporter Escrow Reimbursement for Spoilage",
      category: "Escrow Dispute",
      proposer: "0x7099...79C8 (Punjab Mandi Delegate)",
      forVotes: 742000,
      againstVotes: 120000,
      quorum: 86,
      status: "Active",
      endsIn: "1 day 4 hours",
    },
    {
      id: "PROP-MNDI-100",
      title: "Adjust Minimum Temperature Spoilage Breach Threshold to 12.5°C",
      category: "Protocol Parameter",
      proposer: "0x3C44...3572 (Transport Union)",
      forVotes: 980000,
      againstVotes: 15000,
      quorum: 99,
      status: "Succeeded",
      endsIn: "Ended",
    },
  ]);

  const [votedProposals, setVotedProposals] = useState<Record<string, string>>({});

  const handleVote = (proposalId: string, choice: "for" | "against" | "abstain") => {
    setVotedProposals((prev) => ({ ...prev, [proposalId]: choice }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
              <Shield className="w-5 h-5" />
              <span>Web3 On-Chain Governance</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">🏛️ Mandi DAO Dispute & Governance Portal</h1>
            <p className="text-slate-400 text-sm mt-1">
              Stake Mandi Governance Tokens (MNDI) to vote on cold-chain dispute escrow resolution and Mandi policy parameters.
            </p>
          </div>
          <Link
            href="/mandi"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
          >
            ← Back to Mandi Hub
          </Link>
        </div>

        {/* Proposals List */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Vote className="w-5 h-5 text-emerald-400" />
            Active Dispute & Parameter Proposals
          </h2>

          <div className="grid grid-cols-1 gap-6">
            {proposals.map((prop) => {
              const totalVotes = prop.forVotes + prop.againstVotes;
              const forPercent = Math.round((prop.forVotes / (totalVotes || 1)) * 100);

              return (
                <div
                  key={prop.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4"
                >
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div>
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                        {prop.category}
                      </span>
                      <h3 className="text-lg font-bold mt-2">{prop.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">Proposer: {prop.proposer}</p>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>{prop.endsIn}</span>
                    </div>
                  </div>

                  {/* Quorum Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Quorum Progress: {prop.quorum}%</span>
                      <span>{forPercent}% For</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${forPercent}%` }} />
                      <div className="bg-rose-500 h-full" style={{ width: `${100 - forPercent}%` }} />
                    </div>
                  </div>

                  {/* Voting Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVote(prop.id, "for")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                          votedProposals[prop.id] === "for"
                            ? "bg-emerald-600 border-emerald-400 text-white"
                            : "bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60"
                        }`}
                      >
                        👍 Vote FOR
                      </button>
                      <button
                        onClick={() => handleVote(prop.id, "against")}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                          votedProposals[prop.id] === "against"
                            ? "bg-rose-600 border-rose-400 text-white"
                            : "bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/60"
                        }`}
                      >
                        👎 Vote AGAINST
                      </button>
                    </div>

                    {votedProposals[prop.id] && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Vote Recorded On-Chain</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
