import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "../../test/utils";
import LoadMore from "./LoadMore";

describe("LoadMore", () => {
  it("offers to load more while there is more, and calls back when pressed", async () => {
    const onLoadMore = vi.fn();
    render(<LoadMore hasMore loadingMore={false} onLoadMore={onLoadMore} />);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("can name what it loads", () => {
    render(<LoadMore hasMore loadingMore={false} onLoadMore={() => {}} label="Show older tickets" />);
    expect(screen.getByRole("button", { name: "Show older tickets" })).toBeInTheDocument();
  });

  it("says it is loading, and cannot be pressed again, while the next page is on its way", () => {
    render(<LoadMore hasMore loadingMore onLoadMore={() => {}} />);
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
  });

  it("shows nothing when there is nothing more and no problem", () => {
    const { container } = render(<LoadMore hasMore={false} loadingMore={false} onLoadMore={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains a failure and offers to try again, even if it thinks there is no more", async () => {
    const onLoadMore = vi.fn();
    render(<LoadMore hasMore={false} loadingMore={false} error={new Error("Server busy")} onLoadMore={onLoadMore} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load more. Server busy");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
