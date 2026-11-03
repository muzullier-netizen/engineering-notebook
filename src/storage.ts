type StoredRecord = {id:string;kind:'entry'|'favorite'|'file';data:any;updated?:string};
type StoredFile = {id:string;blob:Blob};
let connection:Promise<IDBDatabase>|undefined;
function openDatabase(){
 if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(new Error('浏览器不支持本机存储，请使用普通浏览模式打开。'));return;}
  const request=indexedDB.open('engineering-notebook-independent',1);
  request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('records',{keyPath:'id'});db.createObjectStore('files',{keyPath:'id'});};
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=undefined;};resolve(request.result);};
  request.onerror=()=>{connection=undefined;reject(new Error('无法打开本机存储，请检查浏览器隐私或存储设置。'));};
  request.onblocked=()=>{connection=undefined;reject(new Error('请关闭此网站的其他标签页后重试。'));};
 });
 return connection;
}
async function read<T>(store:string,key?:string):Promise<T>{const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const r=key===undefined?tx.objectStore(store).getAll():tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result as T);r.onerror=()=>reject(new Error('读取本机数据失败。'));});}
async function write(stores:string[],work:(tx:IDBTransaction)=>void){const db=await openDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('保存失败，可能是浏览器空间不足；请导出备份并检查存储设置。'));tx.onabort=()=>reject(new Error('保存未完成，请重试。'));try{work(tx);}catch(e){tx.abort();reject(e);}});}
function validateRecord(x:any):asserts x is StoredRecord{
 if(!x||typeof x.id!=='string'||!x.id||x.id.length>200||!['entry','favorite','file'].includes(x.kind)||!x.data||JSON.stringify(x.data).length>100000)throw new Error('数据格式无效或过长。');
 if(x.kind==='entry'){
  const d=x.data;
  if(typeof d.title!=='string'||!d.title.trim()||typeof d.summary!=='string'||typeof d.body!=='string'||typeof d.category!=='string'||!Array.isArray(d.projects)||!d.projects.every((v:any)=>typeof v==='string')||!Array.isArray(d.tags)||!d.tags.every((v:any)=>typeof v==='string')||!Array.isArray(d.sources)||!d.sources.every((s:any)=>typeof s?.label==='string'&&typeof s?.url==='string'))throw new Error('知识条目格式无效。');
 }
 if(x.kind==='favorite'&&(typeof x.data.entry!=='string'||typeof x.data.value!=='boolean'))throw new Error('收藏格式无效。');
}
export async function getFile(id:string):Promise<StoredFile>{const f=await read<StoredFile|undefined>('files',id);if(!f?.blob)throw new Error('此浏览器中没有该文件，换设备后请重新选择模型原文件。');return f;}
export async function downloadFile(id:string){const [f,record]=await Promise.all([getFile(id),read<StoredRecord>('records',id)]);const a=document.createElement('a');const url=URL.createObjectURL(f.blob);a.href=url;a.download=record?.data.name||'文件';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function localCall(url:string,options?:RequestInit):Promise<any>{
 const parsed=new URL(url,'https://local.invalid');const method=options?.method||'GET';const id=parsed.searchParams.get('id');
 if(parsed.pathname==='/api/records'){
  if(method==='GET')return read<StoredRecord[]>('records');
  if(method==='POST'){
   const record=JSON.parse(String(options?.body));validateRecord(record);
   const prior=await read<StoredRecord|undefined>('records',record.id);
   if(prior&&prior.kind!==record.kind)throw new Error('记录类型不匹配。');
   if(record.kind==='file'){
    if(!prior||typeof record.data.name!=='string'||!record.data.name.trim()||record.data.name.length>240)throw new Error('文件信息无效。');
    record.data={...record.data,key:prior.data.key,size:prior.data.size,created:prior.data.created};
   }
   record.updated=new Date().toISOString();
   await write(['records'],tx=>tx.objectStore('records').put(record));return {ok:true};
  }
  if(method==='DELETE'&&id){const record=await read<StoredRecord|undefined>('records',id);if(record?.kind==='file')throw new Error('请从文件入口删除文件。');await write(['records'],tx=>tx.objectStore('records').delete(id));return {ok:true};}
 }
 if(parsed.pathname==='/api/files'){
  if(method==='POST'){
   const blob=options?.body;if(!(blob instanceof Blob)||!blob.size||blob.size>50*1024*1024)throw new Error('请选择非空且不超过50MB的文件。');
   const fileId='file-'+crypto.randomUUID();const now=new Date().toISOString();const name=parsed.searchParams.get('name')||'文件';if(name.length>240)throw new Error('文件名过长。');
   const record:StoredRecord={id:fileId,kind:'file',updated:now,data:{key:fileId,name,project:parsed.searchParams.get('project')||'通用',note:'',entry:'',size:blob.size,created:now}};
   await write(['records','files'],tx=>{tx.objectStore('files').put({id:fileId,blob});tx.objectStore('records').put(record);});return record;
  }
  if(method==='DELETE'&&id){await write(['records','files'],tx=>{tx.objectStore('records').delete(id);tx.objectStore('files').delete(id);});return {ok:true};}
 }
 throw new Error('不支持的本机操作。');
}
