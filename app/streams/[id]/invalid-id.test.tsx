/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { useParams } from "next/navigation";
import { afterEach, expect, it, vi } from "vitest";

import StreamDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useRouter: () => ({ back: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());

it.each(["..", "/", "?", "#"])("shows not found for invalid id %j without fetching", (id) => {
  vi.mocked(useParams).mockReturnValue({ id });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);

  render(<StreamDetailPage />);

  expect(screen.getByRole("heading", { name: "Stream not found" })).toBeDefined();
  expect(fetch).not.toHaveBeenCalled();
});
