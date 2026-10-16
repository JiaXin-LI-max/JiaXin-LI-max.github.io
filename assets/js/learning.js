(() => {
  'use strict';
  const planRoot = document.querySelector('[data-weekly-v2]');
  const atlasRoot = document.querySelector('[data-starfield]');
  if (!planRoot && !atlasRoot) return;
  const plan = JSON.parse(document.getElementById('learning-plan-data').textContent);
  const atlas = JSON.parse(document.getElementById('learning-skills-data').textContent);
  const bySkill = new Map(atlas.skills.map(skill => [skill.id, skill]));
  const byWeek = new Map(plan.weeks.map(week => [week.id, week]));
  const taskIDs = new Set();
  plan.weeks.forEach(week => ['career','research','acceptance'].forEach(group => week[group].split('；').forEach((_,index) => taskIDs.add(week.id + '-' + group + '-' + index))));
  const key = 'petal-learning-progress-v1';
  const empty = () => ({app:'petal-learning',version:1,tasks:{},skills:{},weekNotes:{},skillNotes:{},lastWeek:''});
  const sanitise = raw => {
    if (!raw || raw.app !== 'petal-learning' || raw.version !== 1) throw new Error('请选择本网站导出的进度备份。');
    const safe = empty();
    for (const name of ['tasks','skills','weekNotes','skillNotes']) {
      const input = raw[name];
      if (!input || typeof input !== 'object' || Array.isArray(input)) continue;
      for (const [id,value] of Object.entries(input)) {
        const valid = name === 'tasks' ? taskIDs.has(id) : name === 'weekNotes' ? byWeek.has(id) : bySkill.has(id);
        if (!valid) continue;
        if (name === 'tasks' || name === 'skills') { if (typeof value === 'boolean') safe[name][id] = value; }
        else if (typeof value === 'string') safe[name][id] = value.slice(0,20000);
      }
    }
    if (byWeek.has(raw.lastWeek)) safe.lastWeek = raw.lastWeek;
    return safe;
  };
  let state = empty();
  let canSave = true;
  try { const raw = localStorage.getItem(key); if (raw) state = sanitise(JSON.parse(raw)); }
  catch { canSave = false; }
  const status = text => document.querySelectorAll('[data-save-status]').forEach(el => { el.textContent = text; });
  const persist = () => {
    try { localStorage.setItem(key,JSON.stringify(state));canSave=true;status('已保存到当前浏览器'); }
    catch { canSave=false;status('暂时无法保存，请导出备份'); }
  };
  if (!canSave) status('暂时无法保存，请导出备份');
  let refreshPlan = () => {};
  let refreshAtlas = () => {};
  const refresh = () => { refreshPlan();refreshAtlas(); };
  document.querySelectorAll('[data-learning-export]').forEach(button => button.addEventListener('click', () => {
    const date = new Date();
    const filename = 'learning-progress-' + date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0') + '.json';
    const url = URL.createObjectURL(new Blob([JSON.stringify({...state,exportedAt:date.toISOString()},null,2)],{type:'application/json'}));
    const link = document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('已导出，可在另一台设备导入');
  }));
  document.querySelectorAll('[data-learning-import]').forEach(input => input.addEventListener('change',async () => {
    const file = input.files[0]; if (!file) return;
    try {
      if (file.size > 2*1024*1024) throw new Error('备份文件过大，请检查是否选对文件。');
      const imported = sanitise(JSON.parse(await file.text()));
      for (const name of ['tasks','skills']) for (const [id,value] of Object.entries(imported[name])) if(value) state[name][id]=true;
      for (const name of ['weekNotes','skillNotes']) for (const [id,note] of Object.entries(imported[name])) {
        if (!note) continue;
        const current = state[name][id] || '';
        state[name][id] = !current ? note : current.includes(note) ? current : (current + '\n\n〔导入记录〕\n' + note).slice(0,20000);
      }
      persist();refresh();status('已合并进度，保留原有勾选和记录');
    } catch (error) { status(error instanceof SyntaxError ? '无法读取备份，请选择导出的JSON文件' : error.message); }
    input.value='';
  }));
  addEventListener('storage',event => {
    if (event.key !== key || !event.newValue) return;
    try { state=sanitise(JSON.parse(event.newValue));refresh();status('已同步当前浏览器的进度'); } catch { /* An invalid external entry leaves the current state intact. */ }
  });

  if (planRoot) {
    const links = [...planRoot.querySelectorAll('[data-plan-link]')];
    const panels = [...planRoot.querySelectorAll('[data-plan-panel]')];
    const inputs = [...planRoot.querySelectorAll('[data-task-id]')];
    const search = planRoot.querySelector('[data-week-search]');
    const phase = planRoot.querySelector('[data-week-phase]');
    const picker = planRoot.querySelector('[data-week-picker]');
    let active = '';
    const todayID = () => {
      const now = new Date();
      const date = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
      return (plan.weeks.find(week => date >= week.start && date <= week.end) || (date < plan.start ? plan.weeks[0] : plan.weeks.at(-1))).id;
    };
    const select = (id,{historyMode='',move=false}={}) => {
      if (!byWeek.has(id)) id = todayID();
      active=id;state.lastWeek=id;
      panels.forEach(panel=>{panel.hidden=panel.dataset.planPanel!==id;});
      links.forEach(link=>{if(link.dataset.planLink===id)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
      picker.value=id;
      if(historyMode && location.hash!=='#'+id) history[historyMode+'State'](null,'','#'+id);
      const link=links.find(link=>link.dataset.planLink===id);
      const container=planRoot.querySelector('.plan-week-links');
      if(link&&!link.hidden&&innerWidth>640) container.scrollTop=link.offsetTop-container.offsetTop-container.clientHeight/2+link.clientHeight/2;
      if(move){const panel=panels.find(panel=>panel.dataset.planPanel===id);if(panel.getBoundingClientRect().top<90 || panel.getBoundingClientRect().top>innerHeight*.7)panel.scrollIntoView({block:'start'});}
      persist();
    };
    const filter = () => {
      const text=search.value.trim().toLowerCase();
      const visible=[];
      links.forEach(link=>{link.hidden=!(phase.value==='all'||link.dataset.phase===phase.value)||!link.dataset.search.toLowerCase().includes(text);if(!link.hidden)visible.push(link.dataset.planLink);});
      [...picker.options].forEach(option=>{option.hidden=!visible.includes(option.value);});
      planRoot.querySelector('[data-week-empty]').hidden=visible.length>0;
      if(visible.length&&!visible.includes(active))select(visible[0],{historyMode:'replace'});
    };
    search.addEventListener('input',filter);phase.addEventListener('change',filter);
    picker.addEventListener('change',()=>select(picker.value,{historyMode:'push',move:true}));
    links.forEach(link=>link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();select(link.dataset.planLink,{historyMode:'push',move:true});}));
    planRoot.querySelector('[data-current-week]').addEventListener('click',()=>{search.value='';phase.value='all';filter();select(todayID(),{historyMode:'push',move:true});});
    planRoot.querySelectorAll('[data-prev-week],[data-next-week]').forEach(button=>{
      const value=Number(button.dataset.prevWeek || button.dataset.nextWeek);
      const next=button.hasAttribute('data-prev-week')?value-1:value+1;
      button.disabled=next<1||next>58;
      button.addEventListener('click',()=>{search.value='';phase.value='all';filter();select('week-'+next,{historyMode:'push',move:true});});
    });
    addEventListener('hashchange',()=>{if(byWeek.has(location.hash.slice(1))){search.value='';phase.value='all';filter();select(location.hash.slice(1));}});
    addEventListener('popstate',()=>{if(byWeek.has(location.hash.slice(1)))select(location.hash.slice(1));else select(todayID());});
    inputs.forEach(input=>input.addEventListener('change',()=>{state.tasks[input.dataset.taskId]=input.checked;persist();refreshPlan();}));
    planRoot.querySelectorAll('[data-week-note]').forEach(input=>input.addEventListener('input',()=>{state.weekNotes[input.dataset.weekNote]=input.value.slice(0,20000);persist();}));
    const schedules={
      prep:[['校内课程','求职学习','硕士课题'],['校内课程','校内课程','求职学习'],['校内课程','求职学习','硕士课题'],['校内课程','求职学习','硕士课题'],['校内课程','校内课程','求职学习'],['校内课程','求职学习','复盘机动']],
      exam:[['校内课程','校内课程','求职学习'],['校内课程','校内课程','硕士课题'],['校内课程','校内课程','求职学习'],['校内课程','校内课程','硕士课题'],['校内课程','校内课程','求职学习'],['校内课程','校内课程','复盘机动']],
      normal:[['求职学习','模块实现','硕士课题'],['求职学习','模块调试','校内课程'],['求职学习','模块仿真','硕士课题'],['项目开发','联调定位','硕士课题'],['求职专项','硕士课题','校内课程'],['验证文档','硕士课题','复盘机动']],
      prehire:[['求职学习','项目与投递','硕士课题'],['求职学习','项目与投递','校内课程'],['专项练习','笔面试准备','硕士课题'],['项目开发','联调定位','硕士课题'],['求职专项','硕士课题','校内课程'],['验证文档','笔面试准备','复盘机动']],
      autumn:[['岗位投递','笔面试','硕士课题'],['专项练习','笔面试','校内课程'],['项目复盘','笔面试','硕士课题'],['问题补强','笔面试','硕士课题'],['岗位投递','笔面试','硕士课题'],['验证文档','求职复盘','复盘机动']]
    };
    const days=['周一','周二','周三','周四','周五','周六'];
    plan.weeks.forEach(week=>{
      const type=week.number<=2?'prep':week.number<=4?'exam':week.number<=36?'normal':week.number<=45?'prehire':'autumn';
      const tbody=planRoot.querySelector('[data-daily-for="'+week.id+'"]');
      [...schedules[type],['完整休息','不补欠账','自由安排']].forEach((row,index)=>{const tr=document.createElement('tr');[days[index]||'周日',...row].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});tbody.append(tr);});
    });
    refreshPlan=()=>{
      inputs.forEach(input=>{input.checked=!!state.tasks[input.dataset.taskId];});
      planRoot.querySelectorAll('[data-week-note]').forEach(input=>{if(document.activeElement!==input)input.value=state.weekNotes[input.dataset.weekNote]||'';});
      let totalDone=0;
      plan.weeks.forEach(week=>{
        const items=inputs.filter(input=>input.dataset.taskWeek===week.id);const done=items.filter(input=>input.checked).length;totalDone+=done;
        planRoot.querySelector('[data-week-progress="'+week.id+'"]').textContent=done+' / '+items.length+' 项已完成';
        planRoot.querySelector('[data-week-bar="'+week.id+'"]').value=items.length?done/items.length*100:0;
        planRoot.querySelector('[data-week-check="'+week.id+'"]').textContent=done===items.length?'✓':done?done+'/'+items.length:'';
      });
      planRoot.querySelector('[data-total-week-progress]').textContent='任务完成 '+totalDone+' / '+inputs.length+' 项';
    };
    refreshPlan();select(byWeek.has(location.hash.slice(1))?location.hash.slice(1):(state.lastWeek||todayID()));
  }

  if (atlasRoot) {
    const map=atlasRoot.querySelector('[data-star-map]');
    const list=atlasRoot.querySelector('[data-skill-list]');
    const scroller=atlasRoot.querySelector('[data-atlas-scroll]');
    const svg=atlasRoot.querySelector('[data-skill-svg]');
    const inspector=atlasRoot.querySelector('[data-skill-inspector]');
    const search=atlasRoot.querySelector('[data-skill-search]');
    const note=atlasRoot.querySelector('[data-skill-note]');
    const toggle=atlasRoot.querySelector('[data-toggle-star]');
    const weeklyURL=atlasRoot.querySelector('[data-weekly-url]').dataset.weeklyUrl;
    let domain='all',selected='',opener=null,view='map',zoom=1,fit=false;
    const visibleIDs=new Set(atlas.skills.map(skill=>skill.id));
    const updateZoom=()=>{svg.style.minWidth='0';svg.style.width=(fit?Math.min(scroller.clientWidth,scroller.clientHeight*atlas.width/atlas.height):Math.max(1100,scroller.clientWidth)*zoom)+'px';};
    const centre=skill=>{const scale=svg.getBoundingClientRect().width/atlas.width;scroller.scrollTo({left:skill.x*scale-scroller.clientWidth/2,top:skill.y*scale-scroller.clientHeight/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
    const text=(selector,value)=>{atlasRoot.querySelector(selector).textContent=value;};
    const renderInspector=()=>{
      const skill=bySkill.get(selected);if(!skill)return;
      const lit=!!state.skills[skill.id];
      text('[data-inspector-domain]',atlas.domains.find(item=>item.id===skill.domain).label+(skill.optional?' · 可选':''));
      text('[data-inspector-state]',lit?'✦ 已点亮':'✧ 等待你的探索');text('#inspector-title',skill.title);text('[data-inspector-summary]',skill.summary);
      const criteria=atlasRoot.querySelector('[data-inspector-criteria]');criteria.replaceChildren();skill.criteria.forEach(item=>{const li=document.createElement('li');li.textContent=item;criteria.append(li);});
      const deps=atlasRoot.querySelector('[data-inspector-deps]');deps.replaceChildren();
      skill.deps.forEach(id=>{const button=document.createElement('button');button.type='button';button.textContent=bySkill.get(id).title+(state.skills[id]?' ✦':'');button.addEventListener('click',()=>openSkill(id));deps.append(button);});
      if(!skill.deps.length){const span=document.createElement('span');span.textContent='可以从这里开始';deps.append(span);}
      const weeks=atlasRoot.querySelector('[data-inspector-weeks]');weeks.replaceChildren();skill.weeks.forEach(number=>{const link=document.createElement('a');link.href=weeklyURL+'#week-'+number;link.textContent='第'+number+'周';weeks.append(link);});
      if(document.activeElement!==note)note.value=state.skillNotes[skill.id]||'';
      toggle.textContent=lit?'取消点亮':'点亮这颗星';toggle.classList.toggle('is-lit',lit);toggle.setAttribute('aria-pressed',String(lit));
    };
    const openSkill=(id,source=null)=>{
      if(!bySkill.has(id))return;selected=id;if(source)opener=source;
      inspector.hidden=false;renderInspector();
      atlasRoot.querySelectorAll('[data-skill-node]').forEach(node=>node.classList.toggle('is-selected',node.dataset.skillNode===id));
      history.replaceState(null,'','#skill-'+id);
      if(view==='map')centre(bySkill.get(id));
      atlasRoot.querySelector('#inspector-title').focus({preventScroll:true});
    };
    const close=()=>{inspector.hidden=true;selected='';atlasRoot.querySelectorAll('.star-node.is-selected').forEach(node=>node.classList.remove('is-selected'));history.replaceState(null,'',location.pathname+location.search);opener?.focus({preventScroll:true});};
    atlasRoot.querySelector('[data-inspector-close]').addEventListener('click',close);
    addEventListener('keydown',event=>{if(event.key==='Escape'&&!inspector.hidden){event.preventDefault();close();}});
    atlasRoot.querySelectorAll('[data-skill-node]').forEach(node=>node.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();openSkill(node.dataset.skillNode,node);}));
    atlasRoot.querySelectorAll('[data-open-skill]').forEach(button=>button.addEventListener('click',()=>openSkill(button.dataset.openSkill,button)));
    note.addEventListener('input',()=>{if(!selected)return;state.skillNotes[selected]=note.value.slice(0,20000);persist();});
    toggle.addEventListener('click',()=>{if(!selected)return;state.skills[selected]=!state.skills[selected];persist();refreshAtlas();});
    const filter=()=>{
      const query=search.value.trim().toLowerCase();visibleIDs.clear();
      atlas.skills.forEach(skill=>{if((domain==='all'||skill.domain===domain)&&(!query||(skill.title+' '+skill.summary).toLowerCase().includes(query)))visibleIDs.add(skill.id);});
      atlasRoot.querySelectorAll('[data-skill-node]').forEach(node=>{const visible=visibleIDs.has(node.dataset.skillNode);node.classList.toggle('is-dim',!visible);node.setAttribute('tabindex',visible?'0':'-1');node.setAttribute('aria-hidden',String(!visible));});
      atlasRoot.querySelectorAll('[data-list-skill]').forEach(card=>{card.hidden=!visibleIDs.has(card.dataset.listSkill);});
      atlasRoot.querySelectorAll('[data-list-domain]').forEach(section=>{section.hidden=!atlas.skills.some(skill=>skill.domain===section.dataset.listDomain&&visibleIDs.has(skill.id));});
      atlasRoot.querySelectorAll('[data-domain-label]').forEach(label=>label.classList.toggle('is-dim',domain!=='all'&&label.dataset.domainLabel!==domain));
      atlasRoot.querySelectorAll('[data-edge-from]').forEach(edge=>edge.classList.toggle('is-dim',!visibleIDs.has(edge.dataset.edgeFrom)||!visibleIDs.has(edge.dataset.edgeTo)));
      atlasRoot.querySelector('[data-skill-empty]').hidden=visibleIDs.size>0;
      if(view==='map'&&(domain!=='all'||query)&&visibleIDs.size) {
        const items=atlas.skills.filter(skill=>visibleIDs.has(skill.id));
        centre({x:items.reduce((sum,item)=>sum+item.x,0)/items.length,y:items.reduce((sum,item)=>sum+item.y,0)/items.length});
      }
    };
    atlasRoot.querySelectorAll('[data-domain-filter]').forEach(button=>button.addEventListener('click',()=>{domain=button.dataset.domainFilter;atlasRoot.querySelectorAll('[data-domain-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));filter();}));
    search.addEventListener('input',filter);
    atlasRoot.querySelectorAll('[data-atlas-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.atlasView;map.hidden=view!=='map';list.hidden=view!=='list';atlasRoot.querySelectorAll('[data-atlas-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));if(view==='map'){updateZoom();filter();}}));
    atlasRoot.querySelectorAll('[data-map-zoom]').forEach(button=>button.addEventListener('click',()=>{const value=button.dataset.mapZoom;if(value==='fit'){fit=true;zoom=1;}else{if(fit){zoom=scroller.clientWidth/Math.max(1100,scroller.clientWidth);fit=false;}zoom=Math.max(.5,Math.min(2.2,zoom*(value==='in'?1.25:.8)));}updateZoom();if(selected)centre(bySkill.get(selected));}));
    addEventListener('resize',updateZoom,{passive:true});
    refreshAtlas=()=>{
      let main=0,optional=0;
      atlas.skills.forEach(skill=>{
        const lit=!!state.skills[skill.id];if(lit){if(skill.optional)optional++;else main++;}
        const node=atlasRoot.querySelector('[data-skill-node="'+skill.id+'"]');node.classList.toggle('is-lit',lit);node.setAttribute('aria-label','查看'+skill.title+'，'+(lit?'已点亮':'未点亮'));
        atlasRoot.querySelector('[data-list-skill="'+skill.id+'"]').classList.toggle('is-lit',lit);
        atlasRoot.querySelector('[data-skill-state="'+skill.id+'"]').textContent=(lit?'已点亮':'待探索')+(skill.optional?' · 可选':'');
      });
      text('[data-star-count]',main+optional);text('[data-main-count]',main+' / '+atlas.skills.filter(skill=>!skill.optional).length);text('[data-optional-count]',optional+' / '+atlas.skills.filter(skill=>skill.optional).length);
      atlasRoot.querySelector('[data-star-progress]').style.width=(main+optional)/atlas.skills.length*100+'%';
      atlas.domains.forEach(item=>{const skills=atlas.skills.filter(skill=>skill.domain===item.id);text('[data-domain-count="'+item.id+'"]',skills.filter(skill=>state.skills[skill.id]).length+'/'+skills.length);});
      atlasRoot.querySelectorAll('[data-edge-from]').forEach(edge=>edge.classList.toggle('is-lit',!!state.skills[edge.dataset.edgeFrom]&&!!state.skills[edge.dataset.edgeTo]));
      if(selected)renderInspector();
    };
    map.hidden=false;list.hidden=true;updateZoom();refreshAtlas();filter();
    const initial=location.hash.replace(/^#skill-/,'');if(bySkill.has(initial))requestAnimationFrame(()=>{map.scrollIntoView({block:'start'});openSkill(initial);});
    addEventListener('hashchange',()=>{const id=location.hash.replace(/^#skill-/,'');if(bySkill.has(id))openSkill(id);});
  }
})();
