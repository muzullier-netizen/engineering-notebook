export type SyncConfig={url:string;key:string};
type Session={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string}};
export type RecordData={id:string;kind:string;data:any;updated?:string};
let config:SyncConfig|null=null;let session:Session|null=null;let refreshing:Promise<void>|undefined;
const SESSION_KEY='engineering-sync-session-v1';
export function validateConfig(value:any):SyncConfig{
 const url=new URL(value.url);if(url.protocol!=='https:'||!/^([a-z0-9-]+)\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw Error('项目地址应为 https://项目编号.supabase.co');
 const key=String(value.key||'').trim();if(key.startsWith('sb_secret_'))throw Error('不能使用secret密钥，请使用publishable公开密钥。');
 if(!key.startsWith('sb_publishable_')){try{const body=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(body.role!=='anon')throw Error();}catch{throw Error('请使用publishable或anon公开密钥，不能使用service_role。');}}
 return {url:url.origin,key};
}
export function state(){return {configured:!!config,email:session?.user.email||'',signedIn:!!session};}
export async function initializeCloud(){
 const r=await fetch(new URL('sync-config.json',document.baseURI),{cache:'no-store'});if(!r.ok)throw Error('无法读取同步配置，当前使用本地模式。');const value=await r.json();if(!value.url||!value.key)return;config=validateConfig(value);
 try{const value=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(value?.project===config.url&&value?.session?.refresh_token)session=value.session;}catch{session=null;}
}
function saveSession(value:Session|null){if(!value){session=null;localStorage.removeItem(SESSION_KEY);}else{localStorage.setItem(SESSION_KEY,JSON.stringify({project:config!.url,session:value}));session=value;}}
function normalizeSession(value:any):Session{return {...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+value.expires_in};}
async function request(path:string,options:RequestInit={},auth=true):Promise<Response>{
 if(!config)throw Error('尚未连接云端。');if(auth){if(!session)throw Error('请先登录。');if(session.expires_at<Date.now()/1000+60){refreshing??=refreshToken().finally(()=>{refreshing=undefined;});await refreshing;}}
 const headers=new Headers(options.headers);headers.set('apikey',config.key);if(auth&&session)headers.set('Authorization','Bearer '+session.access_token);
 let response:Response;try{response=await fetch(config.url+path,{...options,headers,signal:AbortSignal.timeout(45000)});}catch{throw Error('云端连接失败，本次操作未确认保存。请检查网络后重试。');}
 if(!response.ok){const text=await response.text();let reason='';try{const e=JSON.parse(text);reason=e.msg||e.message||e.error_description||e.error||'';}catch{}
  if(response.status===401)throw Error('登录已失效，请退出后重新登录。');if(response.status===409)throw Error('云端已有此记录，请刷新后重新编辑，避免覆盖其他设备的修改。');throw Error('云端操作失败（'+response.status+'）：'+reason.slice(0,180));}return response;
}
async function refreshToken(){if(!session)throw Error('请重新登录。');const r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})},false);saveSession(normalizeSession(await r.json()));}
export async function login(email:string,password:string){const r=await request('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})},false);saveSession(normalizeSession(await r.json()));}
export async function logout(){try{if(session)await request('/auth/v1/logout',{method:'POST'});}finally{saveSession(null);}}
function owner(){if(!session)throw Error('请登录。');return session.user.id;}
function filter(id:string){return 'owner=eq.'+encodeURIComponent(owner())+'&id=eq.'+encodeURIComponent(id);}
function fromRow(x:any):RecordData{return {id:x.id,kind:x.kind,data:x.data,updated:x.updated_at};}
export async function listRecords(){const out:RecordData[]=[];for(let offset=0;;offset+=500){const r=await request('/rest/v1/notebook_records?select=id,kind,data,updated_at&order=id&limit=500&offset='+offset);const rows=await r.json();out.push(...rows.map(fromRow));if(rows.length<500)break;}return out;}
function validateRecord(x:RecordData){if(!x||typeof x.id!=='string'||!x.id||x.id.length>200||!['entry','favorite','file'].includes(x.kind)||!x.data||JSON.stringify(x.data).length>100000)throw Error('无效记录。');if(x.kind==='entry'&&(typeof x.data.title!=='string'||!x.data.title.trim()||typeof x.data.body!=='string'||!Array.isArray(x.data.tags)||!Array.isArray(x.data.projects)||!Array.isArray(x.data.sources)))throw Error('笔记格式无效。');}
export async function putRecord(record:RecordData){validateRecord(record);const data={...record.data};delete data.revision;
 const updated=record.updated||record.data.revision;const path='/rest/v1/notebook_records'+(updated?'?'+filter(record.id)+'&updated_at=eq.'+encodeURIComponent(updated):'');const payload=updated?{data}:{owner:owner(),id:record.id,kind:record.kind,data};
 const r=await request(path,{method:updated?'PATCH':'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)});const rows=await r.json();if(rows.length!==1)throw Error('云端记录已被其他设备修改或删除，请刷新后再编辑。');return {ok:true,record:fromRow(rows[0])};
}
export async function deleteRecord(id:string,revision?:string){const r=await request('/rest/v1/notebook_records?'+filter(id)+(revision?'&updated_at=eq.'+encodeURIComponent(revision):''),{method:'DELETE',headers:{Prefer:'return=representation'}});const rows=await r.json();if(revision&&!rows.length)throw Error('云端记录已发生变化，请刷新后再操作。');return {ok:true};}
function filePath(id:string){if(!/^file-[0-9a-f-]+$/i.test(id))throw Error('文件编号无效。');return owner()+'/'+id;}
export async function getCloudFile(id:string){const r=await request('/storage/v1/object/authenticated/notebook-files/'+filePath(id));return {id,blob:await r.blob()};}
export async function uploadCloudFile(blob:Blob,name:string,project:string,id='file-'+crypto.randomUUID(),note='',entry=''){
 if(!blob.size||blob.size>50*1024*1024)throw Error('文件必须为1字节至50MB。');const key=filePath(id);await request('/storage/v1/object/notebook-files/'+key,{method:'POST',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});
 const record:RecordData={id,kind:'file',data:{key,name,project,note,entry,size:blob.size,created:new Date().toISOString()}};
 try{const result=await putRecord(record);return result.record;}catch(e){try{await request('/storage/v1/object/notebook-files',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})});}catch{throw Error('文件已上传，但资料记录保存失败，清理也未确认。请在云端Storage核对后重试。');}throw e;}
}
export async function deleteCloudFile(id:string,revision?:string){await deleteRecord(id,revision);try{await request('/storage/v1/object/notebook-files',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[filePath(id)]})});}catch{throw Error('资料记录已删除，但云端原文件清理未确认。请到Storage核对。');}return {ok:true};}
