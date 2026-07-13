'use client'

export default function SentryExamplePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-8 dark:bg-gray-950">
      <button
        className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        onClick={() => {
          throw new Error('Sentry Example Frontend Error')
        }}
      >
        Throw test error
      </button>
    </div>
  )
}
