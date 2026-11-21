import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import TestimonialPublic from "./TestimonialPublic";

const INFO = { title: "Share your experience", message: "Two minutes, we promise.", advisorName: "Sam Advisor", prefillName: "" };

function open(info = INFO) {
  server.use(http.get(`${API}/api/testimonials/public/abc`, () => HttpResponse.json(info)));
  return renderWithProviders(
    <Routes>
      <Route path="/testimonial/:slug" element={<TestimonialPublic />} />
    </Routes>,
    { route: "/testimonial/abc", providers: ["router", "toast"] }
  );
}

/** Records the one submission the page makes. */
function capture(status = 201, body = { ok: true }) {
  const seen = { calls: 0, form: null };
  server.use(
    http.post(`${API}/api/testimonials/public/abc/submit`, async ({ request }) => {
      seen.calls += 1;
      seen.form = await request.formData();
      return HttpResponse.json(body, { status });
    })
  );
  return seen;
}

const fill = async (name = "Dana", text = "She was wonderful.") => {
  await userEvent.type(await screen.findByLabelText(/your name/i), name);
  await userEvent.type(screen.getByLabelText(/what do you think/i), text);
};

describe("the public testimonial page", () => {
  it("says who it is for and what they asked, with no sign-in", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Share your experience" })).toBeInTheDocument();
    expect(screen.getByText("For Sam Advisor")).toBeInTheDocument();
    expect(screen.getByText("Two minutes, we promise.")).toBeInTheDocument();
  });

  it("starts from the client's own name on a client's link", async () => {
    open({ ...INFO, prefillName: "Dana Client" });
    expect(await screen.findByLabelText(/your name/i)).toHaveValue("Dana Client");
  });

  it("says so when the link is not open", async () => {
    server.use(http.get(`${API}/api/testimonials/public/abc`, () => HttpResponse.json({ error: "nope" }, { status: 404 })));
    renderWithProviders(
      <Routes>
        <Route path="/testimonial/:slug" element={<TestimonialPublic />} />
      </Routes>,
      { route: "/testimonial/abc", providers: ["router", "toast"] }
    );
    expect(await screen.findByText("This link isn't open")).toBeInTheDocument();
  });

  it("asks for a name, some words and consent before sending anything", async () => {
    open();
    const seen = capture();
    await userEvent.click(await screen.findByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("tell us your name");
    await userEvent.type(screen.getByLabelText(/your name/i), "Dana");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("write a few words");
    await userEvent.type(screen.getByLabelText(/what do you think/i), "Lovely.");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("may use what you wrote");
    expect(seen.calls).toBe(0);
  });

  it("sends what was typed, the rating and the consent, and then says thank you", async () => {
    open();
    const seen = capture();
    await fill();
    await userEvent.type(screen.getByLabelText(/^email/i), "dana@example.com");
    await userEvent.type(screen.getByLabelText(/job title or company/i), "Dentist");
    await userEvent.click(screen.getByRole("button", { name: "4 stars" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /may use what i wrote/i }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
    expect(Object.fromEntries(seen.form.entries())).toEqual({
      name: "Dana",
      text: "She was wonderful.",
      consent: "true",
      email: "dana@example.com",
      roleCompany: "Dentist",
      rating: "4",
    });
  });

  it("leaves the hidden field out when nothing filled it, and a person cannot reach it", async () => {
    open();
    const seen = capture();
    await fill();
    await userEvent.click(screen.getByRole("checkbox", { name: /may use what i wrote/i }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Thank you!");
    expect(seen.form.has("website")).toBe(false);
  });

  it("shows the server's sentence when it refuses, and lets them try again", async () => {
    open();
    capture(429, { error: "This link has received too many testimonials. Please try again later." });
    await fill();
    await userEvent.click(screen.getByRole("checkbox", { name: /may use what i wrote/i }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many/i);
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("takes a photo, previews it, sends it, and can drop it", async () => {
    open();
    const seen = capture();
    await fill();
    const file = new File([new Uint8Array([137, 80, 78, 71])], "me.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Photo"), file);
    expect(await screen.findByAltText("Preview of what you chose")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(screen.queryByAltText("Preview of what you chose")).not.toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("Photo"), file);
    await screen.findByAltText("Preview of what you chose");
    await userEvent.click(screen.getByRole("checkbox", { name: /may use what i wrote and my photo/i }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Thank you!");
    const sent = seen.form.get("photo");
    expect([sent.type, sent.size]).toEqual(["image/png", 4]);
  });

  it("refuses something that is not an image, or is too big, before sending it", async () => {
    open();
    const seen = capture();
    await fill();
    const input = await screen.findByLabelText("Photo");
    // fireEvent-style upload that bypasses the input's accept filter, as a drag or a rename can
    await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }), { applyAccept: false });
    expect(await screen.findByRole("alert")).toHaveTextContent(/choose an image/i);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await userEvent.upload(input, big);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/larger than 5 MB/i));
    expect(screen.queryByAltText("Preview of what you chose")).not.toBeInTheDocument();
    expect(seen.calls).toBe(0);
  });
});
