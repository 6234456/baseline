import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { buildDashboardProjection } from "./domain/projections";
import { createSeedRepository } from "./domain/seed";

function expectedCashflowPath(values: number[], scaleValues: number[]) {
  const chartWidth = 820;
  const chartHeight = 260;
  const padding = { top: 18, right: 24, bottom: 42, left: 54 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...scaleValues.map((value) => Math.abs(value)));
  const slot = innerWidth / values.length;
  const zeroY = padding.top + innerHeight * 0.72;
  const yFor = (value: number) => zeroY - (value / maxValue) * innerHeight * 0.64;

  return values
    .map((value, index) => {
      const x = padding.left + slot * index + slot / 2;
      const y = yFor(value);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

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

  it("supports workbook header filters, right aligned currency, and table sparklines", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open workbook/i }));

    expect(screen.getByLabelText("Filter Project Code")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter Currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter Progress Trend")).toBeInTheDocument();

    const currencyCell = screen.getByTestId("cell-EPC-001-currency");
    expect(currencyCell).toHaveClass("cell-align-right");
    expect(currencyCell).toHaveTextContent("EUR");
    expect(screen.getByTestId("sparkline-EPC-001-progressTrend")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter Project Code"), { target: { value: "EPC-004" } });
    expect(screen.getByText("EPC-004")).toBeInTheDocument();
    expect(screen.queryByText("EPC-003")).not.toBeInTheDocument();
  });

  it("updates visible chart details from chart interactions", () => {
    const { container } = render(<App />);

    expect(screen.getByText("Cashflow detail")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cashflow-point-2026-08"));
    expect(screen.getByText("2026-08")).toBeInTheDocument();

    expect(screen.getByText("Guarantee detail")).toBeInTheDocument();
    expect(screen.getByLabelText("Stacked guarantee exposure area chart")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid^="guarantee-stack-layer-"]').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByTestId("guarantee-point-2026-09"));
    expect(screen.getAllByText("2026-09").length).toBeGreaterThan(0);
    expect(screen.getByText("Guarantee detail").parentElement).not.toHaveTextContent(/EPC-\d{3} EUR 0k/);

    fireEvent.click(screen.getByRole("button", { name: /open timeline/i }));
    const gantt = screen.getByTestId("unified-gantt-chart");
    expect(gantt).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "EPC-004 timeline" })).not.toBeInTheDocument();
    const viewBoxWidth = Number(gantt.getAttribute("viewBox")?.split(" ")[2] ?? 0);
    const guaranteeWindows = Array.from(gantt.querySelectorAll("rect.guarantee-window"));
    expect(guaranteeWindows.every((window) => Number(window.getAttribute("x")) + Number(window.getAttribute("width")) <= viewBoxWidth)).toBe(true);
    fireEvent.click(screen.getByTestId("timeline-project-EPC-004"));
    expect(screen.getByText("Timeline detail")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open guarantees/i }));
    fireEvent.click(screen.getByTestId("guarantee-heatmap-ING-2026-09"));
    expect(screen.getByText("Exposure cell")).toBeInTheDocument();
  });

  it("uses the cashflow line for cumulative balance instead of duplicating monthly net bars", () => {
    render(<App />);

    const dashboard = buildDashboardProjection(createSeedRepository());
    const line = screen.getByTestId("cashflow-cumulative-line");
    const linePath = line.getAttribute("d");
    const scaleValues = dashboard.cashflow.flatMap((month) => [month.inflow, month.outflow, month.cumulative]);

    expect(linePath).toBe(expectedCashflowPath(dashboard.cashflow.map((month) => month.cumulative), scaleValues));
    expect(linePath).not.toBe(expectedCashflowPath(dashboard.cashflow.map((month) => month.net), scaleValues));
    expect(line).toHaveAccessibleName(/cumulative net cash balance/i);

    fireEvent.click(screen.getByTestId("cashflow-point-2026-08"));
    expect(screen.getAllByText(/Cumulative /).some((element) => element.tagName === "SPAN")).toBe(true);
  });
});
