import { PILOT_APPLICATION_LIMITS } from '@/config/legal';
export interface PilotApplicationInput { fullName:string; companyName:string; email:string; phone:string; businessSegment:string; approximateContacts:string; mainChallenge:string; privacyAccepted:boolean; pilotTermsAccepted:boolean; website?:string }
export function validatePilotApplication(value:unknown):{ok:true;data:PilotApplicationInput}|{ok:false;error:string}{
  if(!value||typeof value!=='object') return {ok:false,error:'Preencha os campos obrigatórios.'};
  const v=value as Record<string,unknown>; const text=(k:keyof typeof PILOT_APPLICATION_LIMITS)=>typeof v[k]==='string'?v[k].trim():'';
  const data={fullName:text('fullName'),companyName:text('companyName'),email:text('email').toLowerCase(),phone:text('phone').replace(/[^\d+]/g,''),businessSegment:text('businessSegment'),approximateContacts:text('approximateContacts'),mainChallenge:text('mainChallenge'),privacyAccepted:v.privacyAccepted===true,pilotTermsAccepted:v.pilotTermsAccepted===true,website:typeof v.website==='string'?v.website:''};
  for(const key of Object.keys(PILOT_APPLICATION_LIMITS) as (keyof typeof PILOT_APPLICATION_LIMITS)[]) if(data[key].length>PILOT_APPLICATION_LIMITS[key]) return {ok:false,error:'Um dos campos ultrapassa o tamanho permitido.'};
  if(data.website) return {ok:false,error:'Não foi possível enviar a solicitação.'};
  if(data.fullName.length<2||!/^\S+@\S+\.\S+$/.test(data.email)||!data.businessSegment||!data.approximateContacts||data.mainChallenge.length<10) return {ok:false,error:'Revise os campos obrigatórios e tente novamente.'};
  if(!data.privacyAccepted||!data.pilotTermsAccepted) return {ok:false,error:'Aceite a Política de Privacidade e as regras do Programa Piloto.'};
  return {ok:true,data};
}
