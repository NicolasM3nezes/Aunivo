import { NextResponse } from 'next/server';
import { LEGAL_DOCUMENTS } from '@/config/legal';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { validatePilotApplication } from '@/lib/legal/pilot-application';
export async function POST(request:Request){
  const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const rate=checkRateLimit(`pilot-application:${forwarded}`,{limit:3,windowMs:60*60*1000}); if(!rate.success)return rateLimitResponse(rate);
  const parsed=validatePilotApplication(await request.json().catch(()=>null)); if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:400});
  const row=parsed.data;
  const {error}=await supabaseAdmin().from('pilot_applications').insert({full_name:row.fullName,company_name:row.companyName||null,email:row.email,phone:row.phone||null,business_segment:row.businessSegment,approximate_contacts:row.approximateContacts,main_challenge:row.mainChallenge,privacy_accepted:row.privacyAccepted,pilot_terms_accepted:row.pilotTermsAccepted,legal_document_version:LEGAL_DOCUMENTS.pilotProgram.version});
  if(error?.code==='23505') return NextResponse.json({message:'Sua solicitação já foi recebida.',accepted:false},{status:200});
  if(error){console.error('[pilot-applications] insert failed',{code:error.code});return NextResponse.json({error:'Não foi possível enviar agora. Tente novamente mais tarde.'},{status:500});}
  return NextResponse.json({message:'Solicitação enviada. Entraremos em contato após a análise.',accepted:true},{status:201});
}
