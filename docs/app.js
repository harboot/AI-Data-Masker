(() => {
  'use strict';
  const CHUNK_SIZE = 4 * 1024 * 1024;
  const $ = id => document.getElementById(id);
  const state = { urls: [] };
  const STORAGE_KEY = 'ai-data-master-detectors-v1';
  const BUILTIN_DETECTORS = [
    { id:'email', name:'Email address', prefix:'EMAIL', pattern:"\\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\\b", valid:()=>true, priority:1 },
    { id:'ip', name:'IPv4 & IPv6 address', prefix:'IP', pattern:'(?<![\\w.])(?:\\d{1,3}\\.){3}\\d{1,3}(?![\\w.])|(?<![\\w:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f:.]{0,15}(?![\\w:])', valid:value=>value.includes(':')?validIPv6(value):validIPv4(value), priority:2 },
    { id:'domain', name:'Supported domain', prefix:'DOMAIN', pattern:'(?<![@\\w-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:com\\.ph|com|org|net)\\b', valid:()=>true, priority:3 },
    { id:'phone', name:'Indonesian phone', prefix:'PHONE', pattern:'(?<!\\d)(?:(?:\\+62|0062|62)[ .-]?8|08)\\d(?:[ .-]?\\d){7,11}(?!\\d)', valid:value=>{const n=value.replace(/\D/g,'');return n.length>=10&&n.length<=15;}, priority:4 },
    { id:'phone-ph', name:'Philippine Phone', prefix:'PHONE_PH', pattern:'(?<!\\d)(?:(?:\\+63|0063|63)[ .-]?9|09)\\d(?:[ .-]?\\d){8}(?!\\d)', valid:value=>{const n=value.replace(/\D/g,'');return /^09\d{9}$/.test(n)||/^639\d{9}$/.test(n)||/^00639\d{9}$/.test(n);}, priority:4 },
    { id:'nik', name:'Indonesian NIK/KTP number', prefix:'NIK', pattern:'(?<!\\d)\\d{16}(?!\\d)', valid:value=>{const day=+value.slice(6,8),month=+value.slice(8,10);return (day>=1&&day<=31||day>=41&&day<=71)&&month>=1&&month<=12;}, priority:5 },
    { id:'card', name:'Luhn-valid credit card', prefix:'CARD', pattern:'(?<!\\d)(?:\\d[ -]?){12,18}\\d(?!\\d)', valid:value=>{const n=value.replace(/\D/g,'');if(n.length<13||n.length>19)return false;let sum=0,alt=false;for(let i=n.length-1;i>=0;i--){let d=+n[i];if(alt&&(d*=2)>9)d-=9;sum+=d;alt=!alt;}return sum%10===0;}, priority:5 }
  ];
  const detectorSettings = loadDetectorSettings();
  const formatSize = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`;
  const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const setFile = (input, nameId, sizeId) => {
    const file = input.files[0];
    if (file) { $(nameId).textContent = file.name; $(sizeId).textContent = formatSize(file.size); }
  };
  const setProgress = (prefix, value) => {
    const percent = Math.max(0, Math.min(100, Math.round(value)));
    $(`${prefix}Progress`).style.display = 'block'; $(`${prefix}Bar`).style.width = `${percent}%`; $(`${prefix}Percent`).textContent = `${percent}%`;
  };
  const setStatus = (id, message, kind = '') => { const el = $(id); el.textContent = message; el.className = `status ${kind}`; };
  const download = (id, blob, name) => {
    const url = URL.createObjectURL(blob); state.urls.push(url); const link = $(id); link.href = url; link.download = name; link.style.display = 'block';
  };
  const outputName = (name, infix) => { const dot = name.lastIndexOf('.'); return dot > 0 ? `${name.slice(0,dot)}.${infix}${name.slice(dot)}` : `${name}.${infix}.txt`; };
  const requestedHeaders = () => [...new Set($('columnHeaders').value.split(/[\n,]+/).map(v=>v.trim()).filter(Boolean))];
  function parseRow(line, delimiter) {
    const cells=[]; let start=0, value='', quoted=false;
    for(let i=0;i<=line.length;i++){const c=line[i];if(i===line.length||(!quoted&&c===delimiter)){cells.push({value,start,end:i});start=i+1;value='';continue;}if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else value+=c;}
    return cells;
  }
  function delimiterFor(text, name='') { const first=(text.split(/\r?\n/,1)[0]||''); if(/\.tsv$/i.test(name))return '\t'; const tabs=(first.match(/\t/g)||[]).length,commas=(first.match(/,/g)||[]).length; return tabs>commas&&tabs?'\t':commas?',':null; }
  function renderPreview(text,file){
    const wrap=$('sourcePreview'),box=$('previewContent');box.replaceChildren();const delimiter=delimiterFor(text,file.name);let rows,headers;
    try{const json=JSON.parse(text);if(Array.isArray(json)&&json.length&&json.every(v=>v&&typeof v==='object'&&!Array.isArray(v))){headers=[...new Set(json.slice(0,8).flatMap(Object.keys))];rows=json.slice(0,8).map(item=>headers.map(h=>item[h]));}}catch(_){/* Preview as delimited or plain text. */}
    if(!rows&&delimiter){const lines=text.split(/\r?\n/).filter((line,i,a)=>line||i<a.length-1).slice(0,9);headers=(parseRow(lines.shift()||'',delimiter)).map(c=>c.value);rows=lines.map(line=>parseRow(line,delimiter).map(c=>c.value));}
    if(rows&&headers.length){const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');headers.slice(0,12).forEach(h=>{const th=document.createElement('th');th.textContent=h;tr.append(th);});head.append(tr);table.append(head);const body=document.createElement('tbody');rows.forEach(row=>{const r=document.createElement('tr');headers.slice(0,12).forEach((_,i)=>{const td=document.createElement('td'),value=row[i];td.textContent=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);r.append(td);});body.append(r);});table.append(body);box.append(table);$('previewMeta').textContent=`First ${rows.length} data rows`;
    }else{const pre=document.createElement('pre');pre.textContent=text.slice(0,4000)||'(empty file)';box.append(pre);$('previewMeta').textContent=text.length>4000?'First 4,000 characters':'File beginning';}wrap.style.display='block';
  }
  const likelyBinary = bytes => {
    if (!bytes.length) return false;
    let suspicious = 0;
    for (const b of bytes) { if (b === 0) return true; if ((b < 7 || (b > 13 && b < 32)) && b !== 27) suspicious++; }
    return suspicious / bytes.length > 0.02;
  };
  async function readTextChunks(file, onText, onProgress) {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let offset = 0;
    while (offset < file.size) {
      const bytes = new Uint8Array(await file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size)).arrayBuffer());
      if (offset === 0 && likelyBinary(bytes.subarray(0, Math.min(bytes.length, 65536)))) throw new Error('This file appears to be binary. Please choose a readable text file.');
      let text;
      try { text = decoder.decode(bytes, { stream: offset + bytes.length < file.size }); } catch (_) { throw new Error('This file is not valid UTF-8 readable text.'); }
      await onText(text, offset + bytes.length >= file.size);
      offset += bytes.length; onProgress(file.size ? offset / file.size * 100 : 100); await tick();
    }
    if (!file.size) { await onText('', true); onProgress(100); }
  }
  function validIPv4(value) { const parts = value.split('.'); return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && +p <= 255); }
  function validIPv6(value) {
    const v = value.replace(/^\[|\]$/g, '').replace(/%.+$/, '');
    if (!v.includes(':') || !/^[0-9a-f:.]+$/i.test(v)) return false;
    let s = v, ipv4Groups = 0;
    const tail = s.split(':').pop();
    if (tail.includes('.')) { if (!validIPv4(tail)) return false; s = s.slice(0, -tail.length) + '0:0'; ipv4Groups = 0; }
    if ((s.match(/::/g) || []).length > 1) return false;
    const groups = s.split(':').filter(Boolean);
    if (groups.some(g => !/^[0-9a-f]{1,4}$/i.test(g))) return false;
    return s.includes('::') ? groups.length < 8 - ipv4Groups : groups.length === 8 - ipv4Groups;
  }
  function loadDetectorSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === 'object' && Array.isArray(saved.custom)) return { disabled:Array.isArray(saved.disabled)?saved.disabled:[], custom:saved.custom.filter(isValidCustomDetector), order:Array.isArray(saved.order)?saved.order.filter(id=>typeof id==='string'):[], columns:typeof saved.columns==='string'?saved.columns:'', values:typeof saved.values==='string'?saved.values:'' };
    } catch (_) { /* Ignore unavailable storage or invalid saved settings. */ }
    return { disabled:[], custom:[], order:[], columns:'', values:'' };
  }
  function isValidCustomDetector(detector) {
    if (!detector || typeof detector.id !== 'string' || typeof detector.name !== 'string' || typeof detector.pattern !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(detector.prefix || '')) return false;
    try { new RegExp(detector.pattern, 'gi'); return true; } catch (_) { return false; }
  }
  function saveDetectorSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(detectorSettings)); } catch (_) { /* The manager still works for this tab. */ }
  }
  function renderDetectors() {
    const list=$('detectorList');list.replaceChildren();
    const available=[...BUILTIN_DETECTORS.map(d=>({...d,builtin:true,enabled:!detectorSettings.disabled.includes(d.id)})),...detectorSettings.custom.map(d=>({...d,builtin:false,enabled:d.enabled!==false}))];
    const positions=new Map(detectorSettings.order.map((id,index)=>[id,index]));
    const detectors=available.sort((a,b)=>(positions.get(a.id)??1e6)-(positions.get(b.id)??1e6));
    detectorSettings.order=detectors.map(d=>d.id);
    detectors.forEach(detector=>{
      const row=document.createElement('div');row.className='detector-row';row.draggable=true;row.dataset.id=detector.id;
      const handle=document.createElement('span');handle.className='drag-handle';handle.textContent='⠿';handle.title='Drag to reorder';
      const toggle=document.createElement('label');toggle.className='detector-toggle';toggle.title=`${detector.enabled?'Disable':'Enable'} ${detector.name}`;
      const input=document.createElement('input');input.type='checkbox';input.checked=detector.enabled;input.setAttribute('aria-label',`Enable ${detector.name}`);const track=document.createElement('span');track.className='toggle-track';toggle.append(input,track);
      input.addEventListener('change',()=>{if(detector.builtin){detectorSettings.disabled=input.checked?detectorSettings.disabled.filter(id=>id!==detector.id):[...new Set([...detectorSettings.disabled,detector.id])];}else{const saved=detectorSettings.custom.find(d=>d.id===detector.id);if(saved)saved.enabled=input.checked;}saveDetectorSettings();renderDetectors();});
      const details=document.createElement('button');details.type='button';details.className='regex-details-button';details.textContent='👁';details.title=`View and test ${detector.name} regex`;details.setAttribute('aria-label',details.title);details.addEventListener('click',()=>openRegexDetails(detector));
      const info=document.createElement('div');info.className='detector-info';const title=document.createElement('div');title.className='detector-name';title.textContent=detector.name;const kind=document.createElement('span');kind.className='detector-kind';kind.textContent=detector.builtin?'Predefined':`Custom · ${detector.prefix}`;title.append(kind);info.append(title);row.append(handle,toggle,details,info);
      if(!detector.builtin){const actions=document.createElement('div');actions.className='detector-actions';const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Edit';edit.addEventListener('click',()=>openDetectorDialog(detector));const remove=document.createElement('button');remove.type='button';remove.className='secondary danger';remove.textContent='Delete';remove.addEventListener('click',()=>{if(confirm(`Delete custom detector “${detector.name}”?`)){detectorSettings.custom=detectorSettings.custom.filter(d=>d.id!==detector.id);detectorSettings.order=detectorSettings.order.filter(id=>id!==detector.id);saveDetectorSettings();renderDetectors();}});actions.append(edit,remove);row.append(actions);}list.append(row);
      row.addEventListener('dragstart',()=>row.classList.add('dragging'));row.addEventListener('dragend',()=>{row.classList.remove('dragging');detectorSettings.order=[...list.children].map(item=>item.dataset.id);saveDetectorSettings();});
    });
  }
  $('detectorList').addEventListener('dragover',event=>{event.preventDefault();const list=$('detectorList'),dragged=list.querySelector('.dragging');if(!dragged)return;const after=[...list.querySelectorAll('.detector-row:not(.dragging)')].find(row=>event.clientY<row.getBoundingClientRect().top+row.offsetHeight/2);list.insertBefore(dragged,after||null);});
  function openDetectorDialog(detector=null){$('detectorDialogTitle').textContent=detector?'Edit detector':'Add detector';$('detectorId').value=detector?.id||'';$('detectorName').value=detector?.name||'';$('detectorPattern').value=detector?.pattern||'';$('detectorPrefix').value=detector?.prefix||'';$('detectorSample').value='';setTestResult('','');$('detectorDialog').showModal();}
  function closeDetectorDialog(){$('detectorDialog').close();}
  function setTestResult(message,kind){const result=$('detectorTestResult');result.textContent=message;result.className=`test-result ${kind}`;}
  function testDetector(){try{const re=new RegExp($('detectorPattern').value,'gi'),sample=$('detectorSample').value,matches=sample.match(re);setTestResult(matches?.length?`Matched ${matches.length} value${matches.length===1?'':'s'}: ${matches.join(', ')}`:'No match found.',matches?.length?'ok':'error');}catch(err){setTestResult(`Invalid regex: ${err.message}`,'error');}}
  function openRegexDetails(detector){$('regexDetailsTitle').textContent=detector.name;$('regexDetailsPrefix').value=detector.prefix;$('regexDetailsPattern').value=detector.pattern;$('regexDetailsSample').value='';const result=$('regexDetailsTestResult');result.textContent='';result.className='test-result';$('regexDetailsDialog').showModal();}
  function testRegexDetails(){const pattern=$('regexDetailsPattern').value,sample=$('regexDetailsSample').value,result=$('regexDetailsTestResult');try{const matches=sample.match(new RegExp(pattern,'gi'));result.textContent=matches?.length?`Matched ${matches.length} value${matches.length===1?'':'s'}: ${matches.join(', ')}`:'No match found.';result.className=`test-result ${matches?.length?'ok':'error'}`;}catch(err){result.textContent=`Invalid regex: ${err.message}`;result.className='test-result error';}}
  $('addDetectorButton').addEventListener('click',()=>openDetectorDialog());$('closeDetectorDialog').addEventListener('click',closeDetectorDialog);$('cancelDetectorButton').addEventListener('click',closeDetectorDialog);$('testDetectorButton').addEventListener('click',testDetector);$('testRegexDetailsButton').addEventListener('click',testRegexDetails);
  $('detectorForm').addEventListener('submit',event=>{event.preventDefault();const id=$('detectorId').value,name=$('detectorName').value.trim(),pattern=$('detectorPattern').value,prefix=$('detectorPrefix').value.trim().toUpperCase();try{new RegExp(pattern,'gi');}catch(err){setTestResult(`Invalid regex: ${err.message}`,'error');return;}const duplicate=BUILTIN_DETECTORS.some(d=>d.prefix===prefix)||detectorSettings.custom.some(d=>d.prefix===prefix&&d.id!==id);if(duplicate){setTestResult('Prefix must be unique.','error');return;}if(id){const detector=detectorSettings.custom.find(d=>d.id===id);Object.assign(detector,{name,pattern,prefix});}else{detectorSettings.custom.push({id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,pattern,prefix,enabled:true});}saveDetectorSettings();renderDetectors();closeDetectorDialog();});
  $('columnHeaders').value=detectorSettings.columns;$('customValues').value=detectorSettings.values;
  ['columnHeaders','customValues'].forEach(id=>$(id).addEventListener('input',()=>{detectorSettings[id==='columnHeaders'?'columns':'values']=$(id).value;saveDetectorSettings();}));
  $('exportSettingsButton').addEventListener('click',()=>{detectorSettings.columns=$('columnHeaders').value;detectorSettings.values=$('customValues').value;const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,...detectorSettings},null,2)],{type:'application/json'})),link=document.createElement('a');state.urls.push(url);link.href=url;link.download='ai-data-masker-settings.json';link.click();$('settingsStatus').textContent='Settings exported.';});
  $('importSettingsButton').addEventListener('click',()=>{$('settingsFile').value='';$('settingsFile').click();});
  $('settingsFile').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!imported||!Array.isArray(imported.custom)||imported.custom.some(d=>!isValidCustomDetector(d)))throw new Error('Invalid settings file.');detectorSettings.disabled=Array.isArray(imported.disabled)?imported.disabled.filter(id=>typeof id==='string'):[];detectorSettings.custom=imported.custom;detectorSettings.order=Array.isArray(imported.order)?imported.order.filter(id=>typeof id==='string'):[];detectorSettings.columns=typeof imported.columns==='string'?imported.columns:'';detectorSettings.values=typeof imported.values==='string'?imported.values:'';$('columnHeaders').value=detectorSettings.columns;$('customValues').value=detectorSettings.values;saveDetectorSettings();renderDetectors();$('settingsStatus').style.color='';$('settingsStatus').textContent='Settings imported successfully.';}catch(err){$('settingsStatus').textContent=err.message||'Unable to import settings.';$('settingsStatus').style.color='var(--bad)';}});
  renderDetectors();
  function createMasker(customInput) {
    const custom = [...new Set(customInput.split(/[\n,]+/).map(v => v.trim()).filter(Boolean))].sort((a,b) => b.length-a.length);
    const definitions = [
      { type:'CUSTOM', re: custom.length ? new RegExp(custom.map(escapeRegex).join('|'), 'g') : null, valid:()=>true, priority:0 },
      ...[...BUILTIN_DETECTORS.map(d=>({...d,enabled:!detectorSettings.disabled.includes(d.id)})),...detectorSettings.custom.map(d=>({...d,valid:()=>true}))]
        .filter(d=>d.enabled!==false).sort((a,b)=>detectorSettings.order.indexOf(a.id)-detectorSettings.order.indexOf(b.id))
        .map((d,index)=>({type:d.prefix,re:new RegExp(d.pattern,'gi'),valid:d.valid,priority:index+1}))
    ];
    const maps = new Map(), mappings = [], counts = {};
    function mask(text) {
      const hits = [];
      for (const d of definitions) { if (!d.re) continue; d.re.lastIndex=0; let m; while ((m=d.re.exec(text))) { if(d.valid(m[0])) hits.push({start:m.index,end:m.index+m[0].length,value:m[0],...d}); if(!m[0].length)d.re.lastIndex++; } }
      hits.sort((a,b)=>a.start-b.start||a.priority-b.priority||(b.end-b.start)-(a.end-a.start));
      const accepted=[]; let end=-1;
      for(const h of hits) if(h.start>=end){accepted.push(h);end=h.end;}
      let out='', pos=0;
      for(const h of accepted){let byValue=maps.get(h.type);if(!byValue){byValue=new Map();maps.set(h.type,byValue);}let token=byValue.get(h.value);if(!token){const number=byValue.size+1;token=`[${h.type}_${String(number).padStart(3,'0')}]`;byValue.set(h.value,token);mappings.push({token,original:h.value,type:h.type});}counts[h.type]=(counts[h.type]||0)+1;out+=text.slice(pos,h.start)+token;pos=h.end;} return out+text.slice(pos);
    }
    function maskColumn(value,header){if(!value)return value;const type='COLUMN',key=`${header}\0${value}`;let byValue=maps.get(type);if(!byValue){byValue=new Map();maps.set(type,byValue);}let token=byValue.get(key);if(!token){token=`[COLUMN_${String(byValue.size+1).padStart(3,'0')}]`;byValue.set(key,token);mappings.push({token,original:value,type,header});}counts[type]=(counts[type]||0)+1;return token;}
    return { mask, maskColumn, mappings, counts };
  }
  $('sourceFile').addEventListener('change', async e => { const file=e.target.files[0];setFile(e.target,'sourceName','sourceSize');$('maskButton').disabled=!file;setStatus('maskStatus',file?'Checking file…':'Select a file to begin.');$('sourcePreview').style.display='none';if(file){try{const bytes=new Uint8Array(await file.slice(0,65536).arrayBuffer());if(likelyBinary(bytes))throw new Error('This file appears to be binary.');new TextDecoder('utf-8',{fatal:true}).decode(bytes);setStatus('maskStatus','Ready to mask locally.');}catch(err){setStatus('maskStatus',err.message||'Unable to read this file.','error');}} });
  $('responseFile').addEventListener('change', e => {setFile(e.target,'responseName','responseSize');updateDecode();});
  $('keyFile').addEventListener('change', e => {setFile(e.target,'keyName','keySize');updateDecode();});
  function updateDecode(){const ready=$('responseFile').files[0]&&$('keyFile').files[0];$('decodeButton').disabled=!ready;setStatus('decodeStatus',ready?'Ready to decode locally.':'Select a response and its JSON key.');}
  $('maskButton').addEventListener('click', async () => {
    const file=$('sourceFile').files[0]; if(!file)return; $('maskButton').disabled=true; $('maskedDownload').style.display=$('keyDownload').style.display='none'; $('sourcePreview').style.display='none'; setStatus('maskStatus','Reading and masking…');setProgress('mask',0);
    try{
      const masker=createMasker($('customValues').value), parts=[],wanted=requestedHeaders();let carry='',headerIndices=null,delimiter=null,preview='';
      await readTextChunks(file,async(text,last)=>{carry+=text;let cut=last?carry.length:carry.lastIndexOf('\n')+1;if(cut>0){let piece=carry.slice(0,cut);carry=carry.slice(cut);if(wanted.length){const lines=piece.split(/(?<=\n)/);for(let i=0;i<lines.length;i++){const ending=(lines[i].match(/\r?\n$/)||[''])[0];let line=lines[i].slice(0,lines[i].length-ending.length);if(headerIndices===null){delimiter=delimiterFor(line,file.name);if(!delimiter)throw new Error('Column masking requires CSV or TSV data.');const headers=parseRow(line,delimiter).map(c=>c.value.trim());const missing=wanted.filter(h=>!headers.includes(h));if(missing.length)throw new Error(`Column header not found: ${missing.join(', ')}`);headerIndices=wanted.map(h=>headers.indexOf(h));}else{const cells=parseRow(line,delimiter),replacements=headerIndices.filter(index=>cells[index]).map(index=>({cell:cells[index],value:masker.maskColumn(cells[index].value,wanted[headerIndices.indexOf(index)])})).sort((a,b)=>b.cell.start-a.cell.start);for(const r of replacements){const raw=line.slice(r.cell.start,r.cell.end),quoted=raw.startsWith('"')&&raw.endsWith('"');line=line.slice(0,r.cell.start)+(quoted?`"${r.value}"`:r.value)+line.slice(r.cell.end);}}lines[i]=line+ending;}piece=lines.join('');}const maskedPiece=masker.mask(piece);parts.push(maskedPiece);if(preview.length<65536)preview+=(maskedPiece.slice(0,65536-preview.length));}},p=>setProgress('mask',p));
      const total=Object.values(masker.counts).reduce((a,b)=>a+b,0), categories=Object.keys(masker.counts).length;
      const key={version:'1.0',createdAt:new Date().toISOString(),mappings:masker.mappings};
      download('maskedDownload',new Blob(parts,{type:'text/plain;charset=utf-8'}),outputName(file.name,'masked'));
      download('keyDownload',new Blob([JSON.stringify(key,null,2)],{type:'application/json'}),outputName(file.name,'key').replace(/\.[^.]+$/,'.json'));
      renderPreview(preview,file);
      setStatus('maskStatus',`Masked ${total.toLocaleString('en-US')} occurrences across ${categories} ${categories===1?'category':'categories'}.`,'ok');
    }catch(err){setStatus('maskStatus',err.message||'Unable to mask this file.','error');}finally{$('maskButton').disabled=false;}
  });
  $('decodeButton').addEventListener('click',async()=>{
    const response=$('responseFile').files[0],keyFile=$('keyFile').files[0];if(!response||!keyFile)return;$('decodeButton').disabled=true;$('decodedDownload').style.display='none';setStatus('decodeStatus','Reading key and decoding…');setProgress('decode',0);
    try{
      let key;try{key=JSON.parse(await keyFile.text());}catch(_){throw new Error('The selected key is not valid JSON.');}
      if(!key||!Array.isArray(key.mappings)||key.mappings.some(m=>!m||typeof m.token!=='string'||typeof m.original!=='string'))throw new Error('The JSON file is not a valid AI Data Masker key.');
      const lookup=new Map(key.mappings.map(m=>[m.token,m.original]));const tokens=[...lookup.keys()].sort((a,b)=>b.length-a.length);const re=tokens.length?new RegExp(tokens.map(escapeRegex).join('|'),'g'):null;const parts=[];let carry='';
      await readTextChunks(response,async(text,last)=>{carry+=text;let cut=last?carry.length:carry.lastIndexOf('\n')+1;if(cut>0){const piece=carry.slice(0,cut);parts.push(re?piece.replace(re,t=>lookup.get(t)):piece);carry=carry.slice(cut);}},p=>setProgress('decode',p));
      download('decodedDownload',new Blob(parts,{type:'text/plain;charset=utf-8'}),outputName(response.name,'decoded'));setStatus('decodeStatus','Response decoded successfully.','ok');
    }catch(err){setStatus('decodeStatus',err.message||'Unable to decode this file.','error');}finally{$('decodeButton').disabled=false;}
  });
  window.addEventListener('beforeunload',()=>state.urls.forEach(URL.revokeObjectURL));
})();
