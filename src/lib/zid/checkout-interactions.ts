// Standalone enhancement keeps this private route outside marketing scripts and analytics.
export function checkoutScript(ar: boolean) {
  const copy = ar
    ? {
        required: "أكمل هذا الحقل للمتابعة.",
        email: "أدخل بريدًا إلكترونيًا صحيحًا.",
        phone: "أدخل رقم جوال سعودي يبدأ بـ 05 أو ‎+966.",
        quantity: "أدخل كمية من ١ إلى ٢٠.",
        consent: "نحتاج موافقتك قبل المتابعة.",
        summary: "راجع الحقول المحددة أدناه.",
        working: "جارٍ التحقق من التفاصيل…",
        creating: "جارٍ إرسال الطلب مرة واحدة…",
        language: "جارٍ تغيير اللغة…",
      }
    : {
        required: "Please complete this field.",
        email: "Enter a valid email address.",
        phone: "Enter a Saudi mobile number starting with 05 or +966.",
        quantity: "Enter a quantity from 1 to 20.",
        consent: "Please confirm before continuing.",
        summary: "A few details need your attention below.",
        working: "Checking your details…",
        creating: "Sending this order once…",
        language: "Changing language…",
      };
  return (
    `const copy=${JSON.stringify(copy)};` +
    String.raw`
(function(){
const checkSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const chevron='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
let closeMenus=function(){};
const closers=[];
closeMenus=function(except){closers.forEach(function(item){if(item!==except)item();});};
document.querySelectorAll('select[data-select]').forEach(function(select){
 const wrapper=document.createElement('div');wrapper.className='pick';
 select.parentNode.insertBefore(wrapper,select);wrapper.appendChild(select);
 const trigger=document.createElement('button');trigger.type='button';trigger.className='control pick-trigger';trigger.id=select.id+'-trigger';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',select.id+'-menu');trigger.setAttribute('aria-labelledby',select.id+'-label '+select.id+'-value');trigger.setAttribute('aria-describedby',select.getAttribute('aria-describedby')||'');
 const value=document.createElement('span');value.className='pick-value';value.id=select.id+'-value';trigger.appendChild(value);trigger.insertAdjacentHTML('beforeend',chevron);
 const menu=document.createElement('div');menu.className='pick-menu';menu.id=select.id+'-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-labelledby',select.id+'-label');menu.hidden=true;
 const options=[];let active=0,search='',lastKey=0;
 Array.from(select.options).forEach(function(option,index){if(!option.value)return;const row=document.createElement('div');row.className='pick-option';row.id=select.id+'-option-'+index;row.setAttribute('role','option');row.setAttribute('aria-disabled',String(option.disabled));const text=document.createElement('span');text.textContent=option.textContent;row.appendChild(text);row.insertAdjacentHTML('beforeend',checkSvg);menu.appendChild(row);options.push({node:row,option:option,index:index});row.addEventListener('pointermove',function(){if(!option.disabled)highlight(options.findIndex(function(o){return o.node===row;}));});row.addEventListener('pointerdown',function(event){event.preventDefault();});row.addEventListener('click',function(){if(!option.disabled)choose(options.findIndex(function(o){return o.node===row;}));});});
 wrapper.append(trigger,menu);select.classList.add('native-enhanced');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 const label=document.querySelector('label[for="'+select.id+'"]');if(label)label.htmlFor=trigger.id;
 function sync(){value.textContent=select.selectedOptions[0] ? select.selectedOptions[0].textContent : '';trigger.dataset.placeholder=String(!select.value);options.forEach(function(o){o.node.setAttribute('aria-selected',String(o.option.value===select.value));});}
 function close(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');}
 closers.push(close);
 function highlight(index){if(!options.length)return;active=(index+options.length)%options.length;options.forEach(function(o,i){o.node.dataset.active=String(i===active);});trigger.setAttribute('aria-activedescendant',options[active].node.id);if(!menu.hidden)options[active].node.scrollIntoView({block:'nearest'});}
 function open(){if(!options.length)return;closeMenus(close);const bounds=trigger.getBoundingClientRect(),below=innerHeight-bounds.bottom,above=bounds.top;menu.dataset.side=below<190&&above>below?'top':'bottom';menu.style.maxHeight=Math.max(80,Math.min(280,(menu.dataset.side==='top'?above:below)-18))+'px';menu.hidden=false;trigger.setAttribute('aria-expanded','true');const selected=options.findIndex(function(o){return o.option.value===select.value&&!o.option.disabled;});highlight(selected>=0?selected:options.findIndex(function(o){return !o.option.disabled;}));}
 function choose(index){const chosen=options[index];if(!chosen||chosen.option.disabled)return;select.value=chosen.option.value;sync();close();trigger.focus();select.dispatchEvent(new Event('change',{bubbles:true}));}
 trigger.addEventListener('click',function(){menu.hidden?open():close();});
 trigger.addEventListener('keydown',function(event){
  const key=event.key;
  if(key==='Escape'){close();return;}
  if(key==='Tab'){close();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(key)){event.preventDefault();if(menu.hidden){open();if(key==='ArrowDown'||key==='ArrowUp')return;}let next=key==='Home'?0:key==='End'?options.length-1:active+(key==='ArrowDown'?1:-1);for(let i=0;i<options.length;i++){next=(next+options.length)%options.length;if(!options[next].option.disabled)break;next+=key==='ArrowUp'?-1:1;}highlight(next);return;}
  if(key==='Enter'||key===' '){event.preventDefault();menu.hidden?open():choose(active);return;}
  if(key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();if(menu.hidden)open();const now=Date.now();search=now-lastKey>700?key:search+key;lastKey=now;const match=options.findIndex(function(o){return !o.option.disabled&&o.option.textContent.trim().toLocaleLowerCase().startsWith(search.toLocaleLowerCase());});if(match>=0)highlight(match);}
 });
 select.addEventListener('change',sync);select.addEventListener('focus',function(){trigger.focus();});sync();
});
document.addEventListener('pointerdown',function(event){if(!event.target.closest('.pick'))closeMenus();});
window.addEventListener('resize',function(){closeMenus();});
function digits(value){return value.replace(/[٠-٩۰-۹]/g,function(d){return String(d.charCodeAt(0)-(d<='٩'?0x660:0x6f0));});}
function showError(control,message){const field=control.closest('.field');if(!field)return;const text=field.querySelector('.field-error');control.setAttribute('aria-invalid',String(!!message));const trigger=field.querySelector('.pick-trigger');if(trigger)trigger.setAttribute('aria-invalid',String(!!message));if(text){text.textContent=message;text.hidden=!message;}}
function validate(control){if(control.type==='hidden'||!control.name||control.disabled)return '';let message='';const value=control.value.trim();if(control.required&&(control.type==='checkbox'?!control.checked:!value))message=control.type==='checkbox'?copy.consent:copy.required;else if(value&&control.type==='email'&&control.validity.typeMismatch)message=copy.email;else if(value&&control.name==='phone'&&!/^5[0-9]{8}$/.test(digits(value).replace(/[s+-]/g,'').replace(/^00966/,'966').replace(/^966/,'').replace(/^0/,'')))message=copy.phone;else if(value&&control.name==='quantity'&&(!/^[0-9]{1,2}$/.test(digits(value))||Number(digits(value))<1||Number(digits(value))>20))message=copy.quantity;showError(control,message);return message;}
document.querySelectorAll('form').forEach(function(form){
 form.noValidate=true;
 form.addEventListener('focusout',function(event){if(event.target.matches('input:not([type=hidden])'))validate(event.target);});
 form.addEventListener('input',function(event){if(event.target.getAttribute('aria-invalid')==='true')validate(event.target);});
 form.addEventListener('change',function(event){if(event.target.matches('input,select'))validate(event.target);});
 form.addEventListener('submit',function(event){
  if(form.getAttribute('aria-busy')==='true'){event.preventDefault();return;}
  const action=form.querySelector('[name=action]'),languageChange=action&&action.value==='language';
  if(!languageChange){let first=null;Array.from(form.elements).forEach(function(control){if(control.matches&&control.matches('input,select')&&validate(control)&&!first)first=control;});const feedback=form.querySelector('.form-feedback');if(first){event.preventDefault();if(feedback){feedback.hidden=false;feedback.textContent=copy.summary;}closeMenus();const field=first.closest('.field'),focus=field&&field.querySelector('.pick-trigger');(focus||first).focus();return;}if(feedback)feedback.hidden=true;}
  closeMenus();form.setAttribute('aria-busy','true');const button=event.submitter||form.querySelector('button[type=submit]');if(button)setTimeout(function(){button.disabled=true;},0);const live=form.querySelector('[role=status]');if(live)live.textContent=languageChange?copy.language:action&&action.value==='create'?copy.creating:copy.working;
 });
});
const languageLink=document.querySelector('[data-language]');if(languageLink)languageLink.addEventListener('click',function(event){const form=document.querySelector('form[data-details]');if(!form)return;event.preventDefault();if(form.getAttribute('aria-busy')==='true')return;form.querySelector('[name=lang]').value=this.dataset.language;form.querySelector('[name=action]').value='language';form.requestSubmit();});
window.addEventListener('pageshow',function(){closeMenus();document.querySelectorAll('form').forEach(function(form){form.removeAttribute('aria-busy');const live=form.querySelector('[role=status]');if(live)live.textContent='';form.noValidate=true;if(form.hasAttribute('data-details')){form.querySelector('[name=action]').value='validate';form.querySelector('[name=lang]').value=document.documentElement.lang;}form.querySelectorAll('button').forEach(function(button){button.disabled=false;});});});
})();`
  );
}
