/* Retained standalone validation and permissions. */
window.SouvenirPolicyFactory=function createPolicy(){
const Utilities={getUuid:()=>crypto.randomUUID()};
const phone_=v=>String(v||'').replace(/\D/g,'').slice(-9);
let saved;const persist_=(db,changed)=>{saved={db,changed}};
/* One-school authorization and relational validation. No client-supplied role is trusted. */
const PUBLIC_TABLES_=['schools','staff','teaching','learners','enrolments','assessments','marks','exams','exam_marks','report_settings','attendance_registers','attendance_terms','attendance_marks','attendance_holidays','assessment_settings','interventions'];
const NATURAL_KEYS_={assessment_settings:['school_id','owner_id','year','class_name','subject'],marks:['assessment_id','learner_id'],exam_marks:['exam_id','learner_id','subject'],report_settings:['school_id','kind','year','term','class_name','learner_id'],attendance_registers:['school_id','year','class_name'],attendance_terms:['register_id','n'],attendance_marks:['term_id','week','learner_id'],attendance_holidays:['school_id','hdate'],teaching:['staff_id','class_name','subject']};
function full_(u){return ['admin','headteacher','dos','hod'].includes(u.role)}
function teaches_(db,u,c,subject){return full_(u)||db.teaching.some(t=>t.staff_id===u.id&&t.class_name===c&&(!subject||!t.subject||t.subject===subject))}
function classTeacher_(db,u,c){return ['admin','headteacher','dos'].includes(u.role)||db.teaching.some(t=>t.staff_id===u.id&&t.class_name===c&&!t.subject)}
function enrols_(db,id){return db.enrolments.filter(e=>e.learner_id===id)}
function find_(db,t,id){return db[t].find(r=>String(r.id)===String(id))}
function registerFor_(db,t,r){if(t==='attendance_registers')return r;if(t==='attendance_terms')return find_(db,'attendance_registers',r.register_id);if(t==='attendance_marks'){const term=find_(db,'attendance_terms',r.term_id);return find_(db,'attendance_registers',r.register_id||term?.register_id)}return null}
function permitted_(db,u,t,r,write){
 if(t==='assessment_settings'||t==='interventions')return full_(u)||r.owner_id===u.id&&teaches_(db,u,r.class_name,r.subject);
 if(t==='schools')return !write||u.role==='admin';
 if(t==='staff'||t==='teaching')return write?u.role==='admin':(full_(u)||t==='staff'&&r.id===u.id||t==='teaching'&&r.staff_id===u.id);
 if(t==='learners'){const es=enrols_(db,r.id);return write?(!es.length&&r.created_by===u.id||u.role==='admin'||['headteacher','dos'].includes(u.role)||es.some(e=>classTeacher_(db,u,e.class_name))):full_(u)||!es.length&&r.created_by===u.id||es.some(e=>teaches_(db,u,e.class_name))}
 if(t==='enrolments')return write?classTeacher_(db,u,r.class_name):teaches_(db,u,r.class_name);
 if(t==='assessments')return teaches_(db,u,r.class_name,write?r.subject:null);
 if(t==='exams')return write?classTeacher_(db,u,r.class_name):teaches_(db,u,r.class_name);
 if(t==='marks'){const a=find_(db,'assessments',r.assessment_id);return !!a&&teaches_(db,u,a.class_name,write?a.subject:null)}
 if(t==='exam_marks'){const e=find_(db,'exams',r.exam_id);return !!e&&teaches_(db,u,e.class_name,write?r.subject:null)}
 if(t==='report_settings')return write?(r.kind==='colors'?['admin','headteacher','dos'].includes(u.role):r.class_name?classTeacher_(db,u,r.class_name):full_(u)||db.teaching.some(t=>t.staff_id===u.id&&!t.subject)):(!r.class_name||teaches_(db,u,r.class_name));
 if(t==='attendance_holidays')return !write||full_(u)||db.teaching.some(t=>t.staff_id===u.id);
 if(t.startsWith('attendance_')){const reg=registerFor_(db,t,r);return !!reg&&(write&&t==='attendance_terms'?classTeacher_(db,u,reg.class_name):teaches_(db,u,reg.class_name))}
 return false;
}
function validateRecord_(db,t,r){
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(String(r.id||'')))throw Error('Invalid record identifier.');
 if(r.school_id&&r.school_id!==db.schools[0].id)throw Error('This app holds one school only.');
 if(t==='schools'&&r.id!==db.schools[0].id)throw Error('Edit the existing school name under Setup.');
 if(t==='staff'){
  if(!['admin','headteacher','dos','hod','class_teacher','subject_teacher','teacher'].includes(r.role))throw Error('Invalid staff role.');
  if(!r.full_name||phone_(r.phone).length<7)throw Error('Name and valid phone number required.');
  if(db.staff.some(s=>s.id!==r.id&&phone_(s.phone)===phone_(r.phone)))throw Error('That phone number is already registered.');
 }
 if(t==='assessment_settings'||t==='interventions'){
  if(!find_(db,'staff',r.owner_id)||!r.class_name||!r.subject||!r.year)throw Error('Teacher, class, subject and year are required.');
  if(t==='assessment_settings'){const sorted=(r.bands||[]).slice().sort((a,b)=>a.from-b.from);let next=0;if(!sorted.length||sorted.length>20)throw Error('Set 1–20 comment bands.');for(const b of sorted){if(!Number.isFinite(b.from)||!Number.isFinite(b.to)||b.from!==next||b.to<=b.from||b.to>100||typeof b.label!=='string'||!b.label.trim()||b.label.length>100)throw Error('Comment bands must cover 0–100 without gaps or overlaps.');next=b.to}if(next!==100||!Number.isFinite(r.msps)||r.msps<0||r.msps>100||!Number.isFinite(r.spi_target)||r.spi_target<0||r.spi_target>100)throw Error('Set valid MSPS and SPI targets (0–100).');}
  else{const parent=find_(db,r.kind==='assessment'?'assessments':'exams',r.parent_id);if(!['assessment','exam'].includes(r.kind)||!parent||parent.class_name!==r.class_name||String(parent.year)!==String(r.year)||r.kind==='assessment'&&parent.subject!==r.subject||r.kind==='exam'&&!(parent.config?.subjects||[]).some(s=>s.name===r.subject))throw Error('Choose a matching assessment or examination and subject.');if(!['planned','in_progress','completed','review'].includes(r.status)||!r.action||!r.method||!/^\d{4}-\d{2}-\d{2}$/.test(r.due_date)||!/^\d{4}-\d{2}-\d{2}$/.test(r.followup_date)||r.followup_date<r.due_date||!Number.isFinite(r.target)||r.target<0||r.target>100)throw Error('Action, method, valid dates and target (0–100) are required.');if(!Array.isArray(r.followups)||r.followups.length>100)throw Error('Invalid follow-up history.');}
 }
 if(t==='teaching'&&!find_(db,'staff',r.staff_id))throw Error('Staff record missing.');
 if(t==='enrolments'){
  if(!find_(db,'learners',r.learner_id)||!r.year||!r.class_name)throw Error('Learner, year and class required.');
  if(db.enrolments.some(e=>e.id!==r.id&&e.learner_id===r.learner_id&&String(e.year)===String(r.year)))throw Error('Learner already enrolled for this year.');
 }
 if(t==='assessments'||t==='exams'){if(!r.name||!r.class_name||!r.year||!(r.exp>0))throw Error('Name, class, year and positive expected marks required.')}
 if(t==='marks'||t==='exam_marks'){
  const p=find_(db,t==='marks'?'assessments':'exams',t==='marks'?r.assessment_id:r.exam_id);
  if(!p||!enrols_(db,r.learner_id).some(e=>e.class_name===p.class_name&&String(e.year)===String(p.year)))throw Error('Learner is not enrolled in this assessment class/year.');
  if(r.mark!==null&&(!Number.isFinite(r.mark)||r.mark<0||r.mark>p.exp))throw Error('Mark is outside the permitted range.');
 }
 if(t==='report_settings'){
  if(!['colors','term','class','learner'].includes(r.kind))throw Error('Invalid report setting.');
  if(r.kind==='learner'&&!enrols_(db,r.learner_id).some(e=>e.class_name===r.class_name&&String(e.year)===String(r.year)))throw Error('Report-card learner does not belong to this class and year.');
 }
 if(t==='attendance_registers'&&(!r.year||!r.class_name))throw Error('Year and class required.');
 if(t==='attendance_terms'){
  if(!find_(db,'attendance_registers',r.register_id)||![1,2,3].includes(r.n)||!Number.isInteger(r.weeks)||r.weeks<1||r.weeks>30)throw Error('Invalid attendance term.');
  if(r.start_date){const d=new Date(r.start_date+'T00:00:00Z');if(d.getUTCDay()!==1)throw Error('Term week 1 must start on Monday.');d.setUTCDate(d.getUTCDate()+r.weeks*7-3);if(r.end_date&&(r.end_date<r.start_date||r.end_date>d.toISOString().slice(0,10)))throw Error('Last school day is outside the configured term.');}
 }
 if(t==='attendance_marks'){
  const term=find_(db,'attendance_terms',r.term_id),reg=registerFor_(db,t,r);
  if(!term||!reg||term.register_id!==reg.id||r.register_id!==reg.id||!Number.isInteger(r.week)||r.week<1||r.week>term.weeks||!/^[.PASH]{10}$/.test(r.codes))throw Error('Invalid attendance mark.');
  if(!enrols_(db,r.learner_id).some(e=>e.class_name===reg.class_name&&String(e.year)===String(reg.year)))throw Error('Learner is not enrolled in this attendance register.');
 }
 if(t==='attendance_holidays'&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.hdate)||!r.name))throw Error('Holiday date and name required.');
}
function matches_(row,filters){return filters.every(([op,k,v])=>op==='eq'?String(row[k]??'')===String(v??''):op==='in'?v.some(x=>String(x)===String(row[k])):op==='gt'?row[k]>v:false)}
function visible_(u,t,r){const out={...r};if(t==='staff'&&u.role!=='admin')delete out.code;return out}
function query_(db,u,q){
 const t=q.table;if(!PUBLIC_TABLES_.includes(t))throw Error('Unknown table.');const op=q.operation||'select',filters=q.filters||[];
 if(filters.length>20)throw Error('Too many filters.');
 let rows=db[t].filter(r=>matches_(r,filters)&&permitted_(db,u,t,r,false));
 if(op!=='select'){
  if((op==='update'||op==='delete')&&!filters.length)throw Error('Select specific records before changing or deleting them.');
  const work=forkDatabase_(db),changed=new Set([t]);let touched=[];
  if(op==='insert'||op==='upsert'){
   const incoming=Array.isArray(q.values)?q.values:[q.values];if(!incoming.length||incoming.length>500)throw Error('Save 1–500 records per request.');
   for(const raw of incoming){const r={...raw};if(t==='staff'&&r.user_id)throw Error('User accounts must be activated with a registration code.');
    const key=(q.conflict||'').split(',').filter(Boolean);const keys=key.length?key:(r.id?['id']:(NATURAL_KEYS_[t]||['id']));
    const old=work[t].find(x=>keys.every(k=>String(x[k]??'')===String(r[k]??'')));
    if(old&&op==='insert')throw Error('That record already exists.');if(old&&q.ignoreDuplicates)continue;
    const row={...(old||{}),...r,id:old?.id||r.id||Utilities.getUuid(),created_at:old?.created_at||r.created_at||new Date().toISOString()};
    if(t==='learners'&&!old)row.created_by=u.id;
    if(t==='staff'&&!old){row.user_id=null;row.active=true;row.school_id=work.schools[0].id}
    const allowedNewLearner=t==='learners'&&!old&&(full_(u)||work.teaching.some(x=>x.staff_id===u.id&&!x.subject));
    if(!allowedNewLearner&&(!permitted_(work,u,t,row,true)||old&&!permitted_(work,u,t,old,true)))throw Error('Your role cannot save this record.');
    validateRecord_(work,t,row);if(old)Object.assign(old,row);else work[t].push(row);touched.push(row);
   }
  }else if(op==='update'){
   if(q.values?.id||q.values?.user_id!==undefined)throw Error('Record and account identifiers cannot be edited.');
   for(const original of rows){const old=work[t].find(r=>r.id===original.id),row={...old,...q.values};if(!permitted_(work,u,t,old,true)||!permitted_(work,u,t,row,true))throw Error('Your role cannot edit this record.');
    if(t==='staff'&&phone_(row.phone)!==phone_(old.phone)&&old.user_id)throw Error('Reset the account before changing its phone number.');
    validateRecord_(work,t,row);Object.assign(old,row);touched.push(row);
   }
  }else if(op==='delete'){
   if(t==='schools')throw Error('This is a one-school app. Edit its name instead of deleting it.');
   for(const r of rows){if(!permitted_(work,u,t,r,true))throw Error('Your role cannot delete this record.');if(t==='staff'&&r.id===u.id)throw Error('You cannot delete your own account.');cascadeDelete_(work,t,r.id,changed)}
  }else throw Error('Unsupported operation.');
  if(changed.has('staff')&&!work.staff.some(s=>s.role==='admin'&&s.active!==false&&s.user_id))throw Error('Keep at least one active administrator.');
  persist_(work,changed);for(const k of changed)db[k]=work[k];rows=touched;
 }
 for(const [column,ascending]of (q.orders||[]).slice().reverse())rows.sort((a,b)=>String(a[column]??'').localeCompare(String(b[column]??''),undefined,{numeric:true})*(ascending?1:-1));
 if(q.range)rows=rows.slice(q.range[0],q.range[1]+1);
 rows=rows.map(r=>{let out=visible_(u,t,r);if(q.columns&&q.columns!=='*')out=Object.fromEntries(q.columns.split(',').map(k=>k.trim()).map(k=>[k,out[k]??null]));return out});
 if(q.single){if(rows.length!==1&&!q.maybeSingle)throw Error('Expected exactly one record.');return rows[0]||null}return rows;
}
function cascadeDelete_(db,t,id,changed){const row=find_(db,t,id);if(!row)return;
 const child=(table,key)=>{for(const r of db[table].filter(r=>String(r[key])===String(id)))cascadeDelete_(db,table,r.id,changed)};
 if(t==='staff'){child('teaching','staff_id');child('assessment_settings','owner_id');child('interventions','owner_id')};if(t==='learners')for(const [table,key]of [['enrolments','learner_id'],['marks','learner_id'],['exam_marks','learner_id'],['attendance_marks','learner_id'],['report_settings','learner_id']])child(table,key);
 if(t==='assessments'){child('marks','assessment_id');child('interventions','parent_id')}if(t==='exams'){child('exam_marks','exam_id');child('interventions','parent_id')}if(t==='attendance_registers')child('attendance_terms','register_id');if(t==='attendance_terms')child('attendance_marks','term_id');db[t]=db[t].filter(r=>r.id!==id);changed.add(t);
}
function forkDatabase_(db){const copy={};for(const t of PUBLIC_TABLES_)Object.defineProperty(copy,t,{enumerable:true,configurable:true,get:function(){const rows=JSON.parse(JSON.stringify(db[t]));Object.defineProperty(copy,t,{value:rows,writable:true,enumerable:true,configurable:true});return rows},set:function(rows){Object.defineProperty(copy,t,{value:rows,writable:true,enumerable:true,configurable:true})}});return copy}

return {tables:PUBLIC_TABLES_,keys:NATURAL_KEYS_,permitted:permitted_,validate:validateRecord_,query(db,user,q){saved=null;const data=query_(db,user,q);return {data,saved}}};
}
