import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "../../test/utils";
import { Badge, Button, Card, Field, Input, Select, Table, inputClass } from ".";

describe("Button", () => {
  it("never submits a form by accident", async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Plain</Button>
      </form>
    );
    await userEvent.click(screen.getByRole("button", { name: "Plain" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when it is told to", async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Send</Button>
      </form>
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("busy disables it, shows the busy label, and ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button busy busyLabel="Saving..." onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByRole("button", { name: "Saving..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps its label when busy and no busy label is given", () => {
    render(<Button busy>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("an unknown variant falls back to primary rather than rendering unstyled", () => {
    render(<Button variant="nope">X</Button>);
    expect(screen.getByRole("button").className).toContain("bg-navy");
  });
});

describe("Field with Input and Select", () => {
  it("ties the label to the control, so a click on the label or a label query finds it", () => {
    render(
      <Field label="Title">
        <Input defaultValue="x" />
      </Field>
    );
    expect(screen.getByLabelText("Title")).toHaveValue("x");
  });

  it("marks a required field and announces an error, tying it to the control", () => {
    render(
      <Field label="Email" required error="Enter an email">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText(/Email/);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter an email");
    expect(input.className).toContain("border-av-red");
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows a hint until there is an error", () => {
    const { rerender } = render(
      <Field label="Name" hint="As on the licence">
        <Input />
      </Field>
    );
    expect(screen.getByText("As on the licence")).toBeInTheDocument();
    rerender(
      <Field label="Name" hint="As on the licence" error="Required">
        <Input />
      </Field>
    );
    expect(screen.queryByText("As on the licence")).not.toBeInTheDocument();
  });

  it("works with a plain element and with a Select, without passing an unknown prop to the DOM", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <Field label="Plain" error="Bad">
          <input />
        </Field>
        <Field label="Pick">
          <Select defaultValue="b">
            <option value="a">A</option>
            <option value="b">B</option>
          </Select>
        </Field>
      </>
    );
    expect(screen.getByLabelText("Plain")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Pick")).toHaveValue("b");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("keeps an id the caller gave the control", () => {
    render(
      <Field label="Own id">
        <Input id="mine" />
      </Field>
    );
    expect(screen.getByLabelText("Own id")).toHaveAttribute("id", "mine");
  });

  it("inputClass turns the border red only when invalid", () => {
    expect(inputClass()).toContain("border-slate-200");
    expect(inputClass(true)).toContain("border-av-red");
  });
});

describe("Badge", () => {
  it("draws its colour from a tone, or from a status meta, and shows the label", () => {
    render(
      <>
        <Badge tone="green">Approved</Badge>
        <Badge meta={{ label: "Open", tone: "blue" }} />
        <Badge tone="unknown-tone">Odd</Badge>
      </>
    );
    expect(screen.getByText("Approved").className).toContain("text-av-green");
    expect(screen.getByText("Open").className).toContain("text-av-blue");
    expect(screen.getByText("Odd").className).toContain("text-slate-500");
  });
});

describe("Card", () => {
  it("renders the element asked for", () => {
    render(
      <Card as="section" aria-label="Panel">
        Hi
      </Card>
    );
    expect(screen.getByRole("region", { name: "Panel" })).toHaveTextContent("Hi");
  });
});

describe("Table", () => {
  const columns = [
    { key: "name", header: "Feature" },
    { key: "credits", header: "Credits", align: "right", render: (r) => `${r.credits} cr` },
  ];

  it("is an accessible table with column headers, a caption and the rows", () => {
    render(<Table caption="Usage" columns={columns} rows={[{ id: 1, name: "Letter", credits: 5 }]} />);
    expect(screen.getByRole("table", { name: "Usage" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Feature", "Credits"]);
    for (const header of screen.getAllByRole("columnheader")) expect(header).toHaveAttribute("scope", "col");
    expect(screen.getByRole("cell", { name: "5 cr" })).toBeInTheDocument();
  });

  it("says so when there are no rows", () => {
    render(<Table columns={columns} rows={[]} empty="No usage yet." />);
    expect(screen.getByText("No usage yet.")).toBeInTheDocument();
  });
});
