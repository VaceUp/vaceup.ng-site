import Link from 'next/link';

export const metadata = {
  title: 'Resources | VaceUp Digital Academy',
  robots: { index: false, follow: false },
};

export default function ResourcesPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-24">
      <div className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gold-brand/15">
          <i className="bi bi-tools text-4xl text-gold-700" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-navy-950">Resources are taking a short break</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-gray-600">
          The free resources library is being updated and will be back soon. In the meantime,
          explore our courses or talk to the academy team if you need a particular guide.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/courses"
            className="rounded-xl bg-gold-brand py-3.5 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
          >
            Browse courses
          </Link>
          <Link
            href="/contact"
            className="rounded-xl border border-gray-200 py-3.5 font-bold text-navy-950 transition-all hover:border-navy-950"
          >
            Contact the academy
          </Link>
        </div>
      </div>
    </main>
  );
}
