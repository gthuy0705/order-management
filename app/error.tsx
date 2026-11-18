"use client";

// Only unexpected errors reach here; validation and business errors are shown
// inline by the forms.
export default function ErrorPage({ retry }: { error: Error; retry: () => void }) {
  return (
    <>
      <h1>Đã có lỗi xảy ra</h1>
      <p className="alert">Lỗi hệ thống, vui lòng thử lại sau.</p>
      <button type="button" onClick={() => retry()}>
        Thử lại
      </button>
    </>
  );
}
