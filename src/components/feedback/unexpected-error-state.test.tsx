import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnexpectedErrorState } from "@/components/feedback/app-states";

describe("UnexpectedErrorState outside development", () => {
  it("shows the server error digest as a support reference, never the raw message", () => {
    render(<UnexpectedErrorState detail="Error: db password rejected" reference="3141592653" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("کد پیگیری: 3141592653");
    expect(alert).not.toHaveTextContent("db password rejected");
  });

  it("shows no reference for client-only errors without a digest", () => {
    render(<UnexpectedErrorState detail="TypeError: x is undefined" />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("کد پیگیری");
    expect(screen.getByRole("alert")).not.toHaveTextContent("TypeError");
  });
});
