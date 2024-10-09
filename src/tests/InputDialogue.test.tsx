import { describe, expect, test, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InputDialogue } from "@/components/InputDialogue";

vi.mock("@/utils/db", () => ({
    classify: vi.fn(),
    prompt: "",
    setPrompt: vi.fn(),
}));

describe("InputDialogue Component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("renders correctly", () => {
        render(<InputDialogue classify={vi.fn()} prompt={""} setPrompt={vi.fn()} />);
        expect(screen.getByText("Your request")).toBeDefined();
        expect(screen.getByPlaceholderText("Ask me anything")).toBeDefined();
        expect(screen.getByText("Submit")).toBeDefined();
        expect(screen.getByText("Here you can ask me anything about the document.")).toBeDefined();
        const textarea = screen.getByPlaceholderText("Ask me anything");
        (textarea as HTMLTextAreaElement).value = "Test";
        expect((textarea as HTMLTextAreaElement).value).toBe("Test");
    });
});