import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("EPC Control Console app", () => {
  it("renders the MVP shell and dashboard context", () => {
    render(<App />);

    expect(screen.getByText("EPC Control Console")).toBeInTheDocument();
    expect(screen.getByText("Portfolio TCV")).toBeInTheDocument();
    expect(screen.getByLabelText("Repository context")).toHaveTextContent("base");
  });

  it("stages and commits a workbook edit through the UI", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open workbook/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit mode/i }));

    const projectName = screen.getByLabelText("Project Name EPC-001");
    fireEvent.change(projectName, { target: { value: "Updated UI Controlled Project" } });

    fireEvent.click(screen.getByRole("button", { name: /stage changes/i }));
    expect(screen.getByText("READY_TO_COMMIT")).toBeInTheDocument();
    expect(screen.getByText(/EPC-001 name:/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/commit message/i), {
      target: { value: "UI workbook edit commit" }
    });
    fireEvent.click(screen.getByRole("button", { name: /commit staged changes/i }));

    expect(screen.getByText(/Committed:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open versions/i }));
    expect(screen.getByText("UI workbook edit commit")).toBeInTheDocument();
  });
});
