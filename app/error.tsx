"use client";

// Only unexpected errors reach here; validation and business errors are shown
// inline by the forms.
export default function ErrorPage({ retry }: { error: Error; retry: () => void }) {
  return (
    <div className="stack panel--narrow">
      <h1>Đã có lỗi xảy ra</h1>
      <p className="alert">Lỗi hệ thống, vui lòng thử lại sau.</p>
      <div>
        <button type="button" className="btn btn--primary" onClick={() => retry()}>
          Thử lại
        </button>
      </div>
    </div>
  );
}
