"use client";

type Props = { error: unknown; retry: () => void };

// Only unexpected errors reach here; validation and business errors are shown
// inline by the forms. Server errors arrive with a `digest`; the same digest is
// in the server log line written by instrumentation.ts, so a user can quote it
// to support.
export default function ErrorPage({ error, retry }: Props) {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : null;

  return (
    <div className="stack panel--narrow">
      <h1>Đã có lỗi xảy ra</h1>
      <p className="alert">Lỗi hệ thống, vui lòng thử lại sau.</p>
      {digest && (
        <p className="muted">
          Mã lỗi (gửi cho bộ phận hỗ trợ): <span className="mono">{digest}</span>
        </p>
      )}
      <div>
        <button type="button" className="btn btn--primary" onClick={() => retry()}>
          Thử lại
        </button>
      </div>
    </div>
  );
}
