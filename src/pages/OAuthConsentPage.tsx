import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Disc3, Music2 } from '@/components/icons';

// Beta @supabase/supabase-js auth.oauth namespace — typed locally.
type AuthzDetails = {
  client?: { name?: string; client_uri?: string };
  redirect_uri?: string;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string; redirect_to?: string } | null;
    error: { message: string } | null;
  }>;
};
const authOAuth = (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get('authorization_id') ?? '';
  const [details, setDetails] = useState<AuthzDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError('Missing authorization_id');
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = '/auth?next=' + encodeURIComponent(next);
        return;
      }
      const { data, error } = await authOAuth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await authOAuth.approveAuthorization(authorizationId)
      : await authOAuth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError('No redirect returned by the authorization server.');
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-8 text-center">
          <h1 className="text-2xl font-boldonse mb-3">Authorization error</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </main>
    );
  }

  const clientName = details.client?.name ?? 'An app';

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center">
            <Music2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-boldonse tracking-wider">SOUNDVAULT</span>
        </div>

        <h1 className="text-2xl font-boldonse mb-2">
          Connect {clientName} to SoundVault
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          {clientName} will be able to call SoundVault's enabled tools while you are
          signed in — searching music, and reading and creating your ratings.
        </p>

        <div className="rounded-xl border border-border/40 bg-secondary/40 p-4 mb-6 text-sm space-y-2">
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
              Access
            </div>
            <div>Act on this app as you</div>
          </div>
          {details.scope && (
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                Scope
              </div>
              <div className="text-xs break-words">{details.scope}</div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-6">
          This does not bypass this app's permissions or backend policies.
        </p>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Cancel connection
          </Button>
          <Button
            className="flex-1 gradient-bg text-primary-foreground border-0"
            disabled={busy}
            onClick={() => decide(true)}
          >
            Approve
          </Button>
        </div>
      </div>
    </main>
  );
}
