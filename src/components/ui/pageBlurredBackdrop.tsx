"use client";

type PageBlurredBackdropProps = {
  imageUrl?: string | null;
};

/** Full-viewport blurred poster/backdrop — matches show episodes pages. */
export default function PageBlurredBackdrop({ imageUrl }: PageBlurredBackdropProps) {
  if (imageUrl) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover object-[center_25%] blur-2xl brightness-[0.72] saturate-150"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute left-[18%] top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute right-[18%] top-0 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-rose-700/10 blur-[120px]" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-black" aria-hidden />
  );
}
