import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, CalendarDays, Tag, User } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { processBioText, splitYears } from "@/lib/cleanAndParseBio";
import { getArtistFactsMB, type MbArtistFacts } from "@/lib/musicbrainz";
import { cn } from "@/lib/utils";

interface ArtistBioProps {
  rawBio: string;
  sourceUrl?: string;
  isLoading?: boolean;
  artistName: string;
  mbid?: string | null;
  genres?: string[];
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {splitYears(text).map((part, i) =>
        part.isYear ? (
          <span key={i} className="font-semibold text-foreground">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function Pill({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-foreground/90">{children}</span>
    </span>
  );
}

const ArtistBio = ({
  rawBio,
  sourceUrl,
  isLoading,
  artistName,
  mbid,
  genres = [],
}: ArtistBioProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [facts, setFacts] = useState<MbArtistFacts | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => processBioText(rawBio), [rawBio]);

  useEffect(() => {
    let cancelled = false;
    setFacts(null);
    if (!mbid) return;
    getArtistFactsMB(mbid)
      .then((f) => !cancelled && setFacts(f))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mbid]);

  useEffect(() => setIsExpanded(false), [rawBio]);

  if (isLoading) {
    return (
      <div className="max-w-3xl rounded-xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm">
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-9/12" />
          <Skeleton className="h-4 w-11/12" />
        </div>
      </div>
    );
  }

  const origin = facts?.beginArea || facts?.area;
  const era =
    facts?.beginYear && facts?.endYear
      ? `${facts.beginYear} – ${facts.endYear}`
      : facts?.beginYear
        ? `Formed ${facts.beginYear}`
        : null;

  const hasFacts = Boolean(origin || era || genres.length);

  if (!parsed.lead) {
    return (
      <div className="max-w-3xl rounded-xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm">
        {hasFacts && (
          <div className="mb-6 flex flex-wrap gap-2">
            {origin && <Pill icon={MapPin}>{origin}</Pill>}
            {era && <Pill icon={CalendarDays}>{era}</Pill>}
            {genres.slice(0, 3).map((g) => (
              <Pill key={g} icon={Tag}>
                {g}
              </Pill>
            ))}
          </div>
        )}
        <div className="py-14 text-center text-muted-foreground">
          <User className="mx-auto mb-3 h-10 w-10 opacity-50" />
          No biography available for {artistName} yet.
        </div>
      </div>
    );
  }

  const collapsible = parsed.wordCount > 220 || parsed.body.length > 2;

  return (
    <div className="max-w-3xl rounded-xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm">
      {hasFacts && (
        <div className="mb-6 flex flex-wrap gap-2">
          {origin && <Pill icon={MapPin}>{origin}</Pill>}
          {era && <Pill icon={CalendarDays}>{era}</Pill>}
          {genres.slice(0, 3).map((g) => (
            <Pill key={g} icon={Tag}>
              {g}
            </Pill>
          ))}
        </div>
      )}

      <div className="relative">
        <div
          ref={contentRef}
          className={cn(
            "overflow-hidden transition-all duration-300",
            !isExpanded && collapsible ? "max-h-[240px]" : "max-h-none",
          )}
        >
          <article>
            <p className="text-lg font-medium leading-relaxed text-foreground/90">
              <RichText text={parsed.lead} />
            </p>

            {parsed.sections.map((section, si) => (
              <section key={si}>
                {section.heading && (
                  <h4 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-primary">
                    {section.heading}
                  </h4>
                )}
                <div className="space-y-4">
                  {section.paragraphs.map((p, pi) => (
                    <p key={pi} className="text-[15px] leading-[1.7] text-muted-foreground">
                      <RichText text={p} />
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </article>
        </div>

        {!isExpanded && collapsible && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>

      {collapsible && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 gap-1.5 px-0 text-primary hover:bg-transparent hover:text-primary/80"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Show less" : "Read full biography"}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      )}

      {sourceUrl && (
        <p className="mt-6 border-t border-border/50 pt-4 text-xs text-muted-foreground">
          Source:{" "}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Last.fm
          </a>
        </p>
      )}
    </div>
  );
};

export default ArtistBio;
