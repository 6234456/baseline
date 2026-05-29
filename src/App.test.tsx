import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("EPC Control Console app", () => {
  it("renders the MVP shell and dashboard context", () => {
    render(<App />);

    expect(screen.getByText("EPC Control Console")).toBeInTheDocument();
    expect(screen.getByText("Portfolio TCV")).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace context")).toHaveTextContent("EUR");
    expect(screen.getByLabelText("Workspace context")).not.toHaveTextContent("a13f29b");
  });

  it("reviews and applies a workbook edit through the UI without exposing revision ids", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open workbook/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit mode/i }));
    expect(screen.queryByText("Source Commit")).not.toBeInTheDocument();

    const projectName = screen.getByLabelText("Project Name EPC-001");
    fireEvent.change(projectName, { target: { value: "Updated UI Controlled Project" } });

    fireEvent.click(screen.getByRole("button", { name: /review changes/i }));
    expect(screen.getByText("Ready to apply")).toBeInTheDocument();
    expect(screen.getByText(/EPC-001 name:/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/change note/i), {
      target: { value: "UI workbook edit saved" }
    });
    fireEvent.click(screen.getByRole("button", { name: /apply reviewed changes/i }));

    expect(screen.getByText("Changes saved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open change log/i }));
    expect(screen.getByText("UI workbook edit saved")).toBeInTheDocument();
    expect(screen.queryByText("Commit History")).not.toBeInTheDocument();
    expect(screen.queryByText("Branch and Tags")).not.toBeInTheDocument();
    expect(screen.queryByText("a13f29b")).not.toBeInTheDocument();
  });

  it("updates visible chart details from chart interactions", () => {
    render(<App />);

    expect(screen.getByText("Cashflow detail")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cashflow-point-2026-08"));
    expect(screen.getByText("2026-08")).toBeInTheDocument();

    expect(screen.getByText("Guarantee detail")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("guarantee-point-2026-09"));
    expect(screen.getAllByText("2026-09").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /open timeline/i }));
    fireEvent.click(screen.getByTestId("timeline-project-EPC-004"));
    expect(screen.getByText("Timeline detail")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open guarantees/i }));
    fireEvent.click(screen.getByTestId("guarantee-heatmap-ING-2026-09"));
    expect(screen.getByText("Exposure cell")).toBeInTheDocument();
  });
});
