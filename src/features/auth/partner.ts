import { createEphemeralClient, supabase } from '@/lib/supabase';

export type PartnerLink = {
  id: string;
  partnerId: string;
  createdAt: string;
};

/**
 * Provision a partner login for the signed-in mother. Creates the partner's auth account on a
 * throwaway client (so the mother's own session is untouched), tagging it with
 * `user_metadata = { role: 'partner', mother_id }` for routing, then links it via `partner_links`.
 *
 * Returns `needsConfirmation: true` when the project still requires email confirmation — the
 * partner can't sign in until they confirm. Disable "Confirm email" in Supabase Auth to skip that.
 */
export async function createPartnerAccount(
  motherId: string,
  email: string,
  password: string,
): Promise<{ partnerId: string; needsConfirmation: boolean }> {
  const ephemeral = createEphemeralClient();
  const { data, error } = await ephemeral.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { role: 'partner', mother_id: motherId } },
  });
  if (error) throw error;

  const partnerId = data.user?.id;
  if (!partnerId) throw new Error('Could not create the partner account. Please try again.');

  const { error: linkError } = await supabase
    .from('partner_links')
    .insert({ mother_id: motherId, partner_id: partnerId });
  if (linkError) throw linkError;

  return { partnerId, needsConfirmation: !data.session };
}

/** The partners the signed-in mother has registered. */
export async function listPartners(): Promise<PartnerLink[]> {
  const { data, error } = await supabase
    .from('partner_links')
    .select('id, partner_id, created_at')
    .order('created_at', { ascending: false })
    .abortSignal(AbortSignal.timeout(8000));
  if (error) throw error;
  return (data as { id: string; partner_id: string; created_at: string }[]).map((r) => ({
    id: r.id,
    partnerId: r.partner_id,
    createdAt: r.created_at,
  }));
}

/** Revoke a partner's access. The auth account remains but loses all access to the mother's data. */
export async function revokePartner(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('partner_links')
    .delete()
    .eq('id', linkId)
    .abortSignal(AbortSignal.timeout(10000));
  if (error) throw error;
}
