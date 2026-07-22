import type { Metadata } from "next";
import Header from "@/components/ui/header";
import { PAGE_CARD } from "@/components/ui/pageCard";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import { APP_VERSION } from "@/lib/appVersion";
import { BUILD_LOG, groupBuildLogByDay } from "@/lib/buildLog";

export const metadata: Metadata = {
  title: "Build log - Teavie",
  description: "Recent changes and releases shipped to Teavie.",
};

export default function BuildLogPage() {
  const groups = groupBuildLogByDay(BUILD_LOG);

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Build log" />
      <div className={`max-w-2xl space-y-5 pb-12 pt-4 ${CONTENT_INSET_X}`}>
        <p className="text-sm text-default-500">
          A running note of what changes in each Teavie build. You&rsquo;re on{" "}
          <span className="font-semibold text-foreground">v{APP_VERSION}</span>.
        </p>

        {groups.length === 0 ? (
          <section className={PAGE_CARD}>
            <p className="text-sm text-default-500">No build history available.</p>
          </section>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.day} className={PAGE_CARD}>
                <h2 className="text-xs font-semibold tracking-wide text-default-400">
                  {group.label}
                </h2>
                <ul className="mt-4 space-y-4">
                  {group.entries.map((entry) => (
                    <li
                      key={`${entry.version}-${entry.title}`}
                      className="flex flex-col gap-3 border-l-2 border-default-200/70 pl-4 dark:border-white/10"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-default-100/80 px-2 py-0.5 text-[11px] font-medium text-default-500 dark:bg-white/[0.06]">
                            v{entry.version}
                          </span>
                          {entry.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-default-200/70 px-2 py-0.5 text-[11px] text-default-400 dark:border-white/10"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">
                            {entry.title}
                          </h3>
                          {entry.summary ? (
                            <p className="mt-1 text-sm leading-relaxed text-default-500">
                              {entry.summary}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <ul className="list-disc space-y-1.5 pl-4">
                        {entry.changes.map((change) => (
                          <li
                            key={change}
                            className="text-sm leading-relaxed text-foreground/85"
                          >
                            {change}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
