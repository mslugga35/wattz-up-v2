"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#052e16] flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-6">
        {/* Lightning bolt / charger icon */}
        <svg
          className="w-20 h-20 mx-auto text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">You&apos;re Offline</h1>
      <p className="text-emerald-300 text-lg mb-2">No connection detected.</p>
      <p className="text-gray-400 text-sm max-w-xs mb-8">
        Wattz Up needs an internet connection to load real-time charger data.
        Connect to Wi-Fi or mobile data and try again.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
