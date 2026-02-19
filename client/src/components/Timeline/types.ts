export type Stage = "farmer" | "transport" | "retailer" | "mandi" | string;
export type Status = "completed" | "pending" | "flagged";

export interface TimelineEvent {
  stage: Stage;
  actor: string;
  location: string;
  timestamp: string;
  status?: Status;
  notes?: string;
  certifications?: string;
}
