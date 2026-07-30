import { render, screen } from "@testing-library/react-native";
import { BatchCard } from "../BatchCard";
import type { Batch } from "../../types";

const mockBatch: Batch = {
  id: "CROP-2024-001",
  crop: "Rice",
  stage: "farmer",
  farmer: "Rajesh Kumar",
  location: "Punjab, India",
  weight: "500 kg",
  price: "₹15,000",
  timestamp: "2024-06-15T10:30:00Z",
  status: "active",
};

describe("BatchCard", () => {
  it("renders batch crop name", () => {
    render(<BatchCard batch={mockBatch} />);
    expect(screen.getByText("Rice")).toBeTruthy();
  });

  it("renders batch ID", () => {
    render(<BatchCard batch={mockBatch} />);
    expect(screen.getByText("ID: CROP-2024-001")).toBeTruthy();
  });

  it("renders farmer name", () => {
    render(<BatchCard batch={mockBatch} />);
    expect(screen.getByText("Farmer: Rajesh Kumar")).toBeTruthy();
  });

  it("renders stage label", () => {
    render(<BatchCard batch={mockBatch} />);
    expect(screen.getByText("Farm")).toBeTruthy();
  });

  it("renders weight and price", () => {
    render(<BatchCard batch={mockBatch} />);
    expect(screen.getByText("500 kg")).toBeTruthy();
    expect(screen.getByText("₹15,000")).toBeTruthy();
  });

  it("renders active status", () => {
    render(<BatchCard batch={mockBatch} />);
    expect(screen.getByText("active")).toBeTruthy();
  });

  it("renders recalled status for recalled batches", () => {
    const recalledBatch: Batch = {
      ...mockBatch,
      status: "recalled",
    };
    render(<BatchCard batch={recalledBatch} />);
    expect(screen.getByText("recalled")).toBeTruthy();
  });

  it("renders transport stage label", () => {
    const transportBatch: Batch = {
      ...mockBatch,
      stage: "transport",
    };
    render(<BatchCard batch={transportBatch} />);
    expect(screen.getByText("In Transit")).toBeTruthy();
  });
});
