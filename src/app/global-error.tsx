"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Something went wrong</h1>

        <p className="mt-2 text-gray-500">
          An unexpected error occurred. Please try again.
        </p>

        <button
          onClick={() => reset()}
          className="mt-6 rounded-md bg-black px-4 py-2 text-white cursor-pointer hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
