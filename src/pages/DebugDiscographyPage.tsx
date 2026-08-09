import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/icons';
import {
  findArtistMbid,
  fetchArtistReleases,
  type MbRelease,
} from '@/lib/musicbrainz';
import { getArtistDiscography } from '@/lib/musicPipeline';
import { searchArtists } from '@/lib/deezer';
import { normalizeAlbumTitle } from '@/lib/discography';
import type { DeezerAlbum } from '@/lib/deezer';

interface DebugResult {
  artistName: string;
  deezerId: string;
  mbid: string | null;
  mbReleases: MbRelease[];
  appAlbums: DeezerAlbum[];
  unmapped: MbRelease[];
  matched: MbRelease[];
}

export default function DebugDiscographyPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DebugResult | null>(null);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const artists = await searchArtists(query.trim(), 1);
      const first = artists[0];
      if (!first) {
        setError('No Deezer artist found for that query.');
        return;
      }
      const deezerId = String(first.id);
      const artistName = first.name;

      const [mbid, payload] = await Promise.all([
        findArtistMbid(deezerId, artistName),
        getArtistDiscography(deezerId, artistName),
      ]);

      const mbReleases = mbid ? await fetchArtistReleases(mbid) : [];

      const appKeys = new Set(
        payload.albums.map((a) => normalizeAlbumTitle(a.title)),
      );
      const unmapped: MbRelease[] = [];
      const matched: MbRelease[] = [];
      for (const rel of mbReleases) {
        const k = normalizeAlbumTitle(rel.title);
        if (appKeys.has(k)) matched.push(rel);
        else unmapped.push(rel);
      }

      setResult({
        artistName,
        deezerId,
        mbid: payload.mbid ?? mbid,
        mbReleases,
        appAlbums: payload.albums,
        unmapped,
        matched,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background pb-8">
      <main className="pt-8 px-6 container mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-boldonse mb-2">Discography Debug</h1>
          <p className="text-muted-foreground text-sm">
            Compares MusicBrainz release-group count with what the app produces
            after the pipeline runs. Lists MB releases whose normalized title
            didn't map into the app's album list.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Artist name (e.g. Metallica)"
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
          <Button onClick={run} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Compare'}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border/40 bg-card/40 p-4 backdrop-blur-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Stat label="Artist" value={result.artistName} />
                <Stat label="Deezer ID" value={result.deezerId} />
                <Stat label="MBID" value={result.mbid ?? '—'} mono />
                <Stat
                  label="MB releases"
                  value={String(result.mbReleases.length)}
                />
                <Stat
                  label="App albums"
                  value={String(result.appAlbums.length)}
                />
                <Stat
                  label="Matched"
                  value={String(result.matched.length)}
                />
                <Stat
                  label="Unmapped"
                  value={String(result.unmapped.length)}
                  emphasis={result.unmapped.length > 0}
                />
                <Stat
                  label="Delta"
                  value={String(result.mbReleases.length - result.appAlbums.length)}
                />
              </div>
            </div>

            <Section title={`Unmapped MB releases (${result.unmapped.length})`}>
              {result.unmapped.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every MB release mapped into the app.
                </p>
              ) : (
                <ReleaseTable releases={result.unmapped} />
              )}
            </Section>

            <Section title={`All MB releases (${result.mbReleases.length})`}>
              <ReleaseTable releases={result.mbReleases} />
            </Section>

            <Section title={`App albums (${result.appAlbums.length})`}>
              <div className="overflow-auto rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left">
                    <tr>
                      <th className="p-2">Title</th>
                      <th className="p-2">Year</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.appAlbums.map((a) => (
                      <tr key={String(a.id)} className="border-t border-border/30">
                        <td className="p-2">{a.title}</td>
                        <td className="p-2">{a.original_year ?? a.release_date?.slice(0, 4) ?? '—'}</td>
                        <td className="p-2">{a.record_type ?? '—'}</td>
                        <td className="p-2 font-mono text-xs">{String(a.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`${mono ? 'font-mono text-xs' : 'text-lg font-semibold'} ${
          emphasis ? 'text-primary' : ''
        } break-all`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function ReleaseTable({ releases }: { releases: MbRelease[] }) {
  return (
    <div className="overflow-auto rounded-lg border border-border/40">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-left">
          <tr>
            <th className="p-2">Title</th>
            <th className="p-2">Year</th>
            <th className="p-2">Type</th>
            <th className="p-2">MBID</th>
          </tr>
        </thead>
        <tbody>
          {releases.map((r) => (
            <tr key={r.mbid} className="border-t border-border/30">
              <td className="p-2">{r.title}</td>
              <td className="p-2">{r.year ?? '—'}</td>
              <td className="p-2">{r.record_type}</td>
              <td className="p-2 font-mono text-xs">
                <a
                  href={`https://musicbrainz.org/release-group/${r.mbid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {r.mbid.slice(0, 8)}…
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
