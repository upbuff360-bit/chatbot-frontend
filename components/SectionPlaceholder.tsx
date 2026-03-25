type SectionPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function SectionPlaceholder({ eyebrow, title, description }: SectionPlaceholderProps) {
  return (
    <section className="space-y-6">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
        </div>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-900">{title} coming next</h2>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          The navigation is ready and this section is now part of the admin shell. We can build this screen next.
        </p>
      </div>
    </section>
  );
}
