import * as local from './local-storage';
import * as cloud from './cloud';
export async function getFile(id:string){return cloud.state().signedIn?cloud.getCloudFile(id):local.getFile(id);}
export async function downloadFile(id:string){if(!cloud.state().signedIn)return local.downloadFile(id);const f=await getFile(id);const record=(await cloud.listRecords()).find(r=>r.id===id);const a=document.createElement('a');const url=URL.createObjectURL(f.blob);a.href=url;a.download=record?.data.name||'文件';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function localCall(url:string,options?:RequestInit):Promise<any>{
 if(!cloud.state().signedIn)return local.localCall(url,options);const u=new URL(url,'https://local.invalid');const method=options?.method||'GET';const id=u.searchParams.get('id');
 if(u.pathname==='/api/records'){if(method==='GET')return cloud.listRecords();if(method==='POST')return cloud.putRecord(JSON.parse(String(options?.body)));if(method==='DELETE'&&id)return cloud.deleteRecord(id,u.searchParams.get('revision')||undefined);}
 if(u.pathname==='/api/files'){if(method==='POST'){if(!(options?.body instanceof Blob))throw Error('请选择文件。');return cloud.uploadCloudFile(options.body,u.searchParams.get('name')||'文件',u.searchParams.get('project')||'通用');}if(method==='DELETE'&&id)return cloud.deleteCloudFile(id,u.searchParams.get('revision')||undefined);}
 throw Error('无效操作。');
}
