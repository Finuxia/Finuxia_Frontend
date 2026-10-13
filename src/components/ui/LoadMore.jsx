/**
 * The control under a list that arrives a page at a time: "Load more" while there is more, a quiet "Loading..." while the next page is on its
 * way, and, if that page could not be fetched, what went wrong with a way to try again. It shows nothing when there is nothing more to load.
 *
 *   <LoadMore hasMore={hasMore} loadingMore={loadingMore} error={items.length > 0 ? error : null} onLoadMore={loadMore} />
 */
export default function LoadMore({ hasMore, loadingMore, error, onLoadMore, label = "Load more" }) {
  if (!hasMore && !error) return null;
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {error && (
        <p role="alert" className="text-sm text-av-red">
          Could not load more. {error.message}
        </p>
      )}
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loadingMore}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loadingMore ? "Loading..." : error ? "Try again" : label}
      </button>
    </div>
  );
}
