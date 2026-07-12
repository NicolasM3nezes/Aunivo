import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeError } from '@/lib/errors/normalize-error';

export type FollowUpItem = { id: string; name: string | null; company: string | null; phone: string; next_follow_up_at: string };
export type RecentContact = { id: string; name: string | null; phone: string; created_at: string };
export type V1DashboardSummary = { totalContacts:number; newContacts:number; openOpportunities:number; wonDeals:number; lostDeals:number; pipelineValue:number; followUpsToday:number; overdueFollowUps:number; followUps:FollowUpItem[]; recentContacts:RecentContact[] };

function requiredError(scope: string, error: unknown): Error {
  const normalized = normalizeError(error);
  return new Error(`Falha ao carregar ${scope}: ${normalized.message}`, { cause: error });
}

export async function loadV1Dashboard(db: SupabaseClient, accountId: string): Promise<V1DashboardSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);

  const [allContacts, newContacts, deals] = await Promise.all([
    db.from('contacts').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
    db.from('contacts').select('id', { count: 'exact', head: true }).eq('account_id', accountId).gte('created_at', monthStart),
    db.from('deals').select('status,value').eq('account_id', accountId),
  ]);
  if (allContacts.error) throw requiredError('contatos', allContacts.error);
  if (newContacts.error) throw requiredError('novos contatos', newContacts.error);
  if (deals.error) throw requiredError('funil', deals.error);

  const [followUpsResult, recentResult] = await Promise.allSettled([
    db.from('contacts').select('id,name,company,phone,next_follow_up_at').eq('account_id', accountId).not('next_follow_up_at','is',null).order('next_follow_up_at').limit(8),
    db.from('contacts').select('id,name,phone,created_at').eq('account_id', accountId).order('created_at',{ascending:false}).limit(6),
  ]);
  let followUps: FollowUpItem[] = [];
  if (followUpsResult.status === 'fulfilled' && !followUpsResult.value.error) followUps = (followUpsResult.value.data ?? []) as FollowUpItem[];
  else console.warn('[dashboard] Follow-ups indisponíveis:', normalizeError(followUpsResult.status === 'rejected' ? followUpsResult.reason : followUpsResult.value.error).message);
  let recentContacts: RecentContact[] = [];
  if (recentResult.status === 'fulfilled' && !recentResult.value.error) recentContacts = (recentResult.value.data ?? []) as RecentContact[];
  else console.warn('[dashboard] Contatos recentes indisponíveis:', normalizeError(recentResult.status === 'rejected' ? recentResult.reason : recentResult.value.error).message);

  const rows=(deals.data??[]) as {status:string;value:number|null}[];
  return { totalContacts:allContacts.count??0,newContacts:newContacts.count??0,openOpportunities:rows.filter(r=>r.status==='open').length,wonDeals:rows.filter(r=>r.status==='won').length,lostDeals:rows.filter(r=>r.status==='lost').length,pipelineValue:rows.filter(r=>r.status==='open').reduce((sum,row)=>sum+Number(row.value??0),0),followUpsToday:followUps.filter(row=>new Date(row.next_follow_up_at)>=todayStart&&new Date(row.next_follow_up_at)<tomorrowStart).length,overdueFollowUps:followUps.filter(row=>new Date(row.next_follow_up_at)<todayStart).length,followUps,recentContacts };
}
