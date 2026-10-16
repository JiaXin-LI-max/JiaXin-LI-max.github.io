/* Weekly navigation progressively enhances usable anchor links. */
(() => {
  document.querySelectorAll('.article-content table, .week-panel table').forEach(table => {
    if (table.parentElement.classList.contains('table-scroll')) return;
    const wrap = document.createElement('div'); wrap.className = 'table-scroll'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '可横向滚动的表格'); table.before(wrap); wrap.append(table);
  });
  document.querySelectorAll('[data-weekly]').forEach(root => {
    const links = [...root.querySelectorAll('[data-week-link]')];
    const panels = [...root.querySelectorAll('[data-week-panel]')];
    if (!links.length || !panels.length) return;
    const select = (id, move = false) => {
      const selected = panels.find(panel => panel.id === id) || panels[0];
      panels.forEach(panel => { panel.hidden = panel !== selected; });
      links.forEach(link => {
        const active = link.hash === '#' + selected.id;
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      if (move) {
        const link = links.find(link => link.hash === '#' + selected.id);
        link?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const top = selected.getBoundingClientRect().top;
        if (top < 90 || top > innerHeight * .8) selected.scrollIntoView({ block: 'start' });
      }
    };
    links.forEach((link, index) => {
      link.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        if (location.hash !== link.hash) history.pushState(null, '', link.hash);
        select(link.hash.slice(1), true);
      });
      link.addEventListener('keydown', event => {
        const keys = ['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + links.length) % links.length;
        links[next].focus(); links[next].click();
      });
    });
    window.addEventListener('hashchange', () => select(location.hash.slice(1)));
    window.addEventListener('popstate', () => select(location.hash.slice(1)));
    select(location.hash.slice(1));
  });

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');
  const canvas = document.createElement('canvas');
  canvas.id = 'petal-particles'; canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let points = [], width = 0, height = 0, frame = 0, last = 0, dark = false;
  const pointer = { x: -1000, y: -1000 };
  const palette = ['168,102,155','124,122,196','102,153,194'];
  const resize = () => {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(width < 640 ? 42 : 100, Math.max(28, Math.round(width * height / 14500)));
    points = Array.from({ length: count }, () => ({ x: Math.random()*width, y: Math.random()*height, vx: (Math.random()-.5)*.16, vy: (Math.random()-.5)*.13, size: .8+Math.random()*1.3, phase: Math.random()*Math.PI*2, color: palette[Math.floor(Math.random()*palette.length)] }));
  };
  const draw = time => {
    frame = 0;
    if (motion.matches || document.hidden) return;
    frame = requestAnimationFrame(draw);
    if (time-last < 32) return;
    const delta = Math.min((time-last)/16.67, 3); last = time;
    ctx.clearRect(0,0,width,height);
    for (const point of points) {
      point.x += point.vx*delta; point.y += point.vy*delta;
      const dx = point.x-pointer.x, dy = point.y-pointer.y, distance = Math.hypot(dx,dy);
      if (finePointer.matches && distance < 125 && distance > 0) { point.x += dx/distance*.24*delta; point.y += dy/distance*.24*delta; }
      if(point.x < -5) point.x=width+5; if(point.x>width+5) point.x=-5;
      if(point.y < -5) point.y=height+5; if(point.y>height+5) point.y=-5;
      const alpha = (dark ? .62 : .42) + Math.sin(time*.0007+point.phase)*.13;
      ctx.beginPath(); ctx.fillStyle = 'rgba('+(dark ? '211,207,250' : point.color)+','+alpha+')';
      if(dark){ ctx.shadowColor='rgba(183,180,255,.55)'; ctx.shadowBlur=7; }
      ctx.arc(point.x,point.y,dark ? point.size*.8 : point.size,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    }
    for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
      const a=points[i],b=points[j],d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d>115) continue;
      ctx.strokeStyle='rgba('+(dark ? '173,175,232' : '155,122,177')+','+(1-d/115)*(dark?.15:.12)+')';
      ctx.lineWidth=.65; ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
  };
  const sync = () => {
    cancelAnimationFrame(frame); frame=0;
    if(motion.matches){canvas.remove();return;}
    if(!canvas.isConnected) {document.body.append(canvas);resize();}
    if(!document.hidden){last=0;frame=requestAnimationFrame(draw);}
  };
  const appearance = () => { dark = document.documentElement.classList.contains('dark'); };
  appearance(); new MutationObserver(appearance).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  addEventListener('resize', resize, {passive:true});
  addEventListener('pointermove', event => { if(finePointer.matches){pointer.x=event.clientX;pointer.y=event.clientY;} }, {passive:true});
  document.documentElement.addEventListener('pointerleave',()=>{pointer.x=-1000;pointer.y=-1000;});
  motion.addEventListener('change',sync); document.addEventListener('visibilitychange',sync); sync();
})();
