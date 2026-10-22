(function(){
  var KEY="medalert-proto-v1";
  var db={profile:null,consent:null,token:null,log:[]};
  try{var s=localStorage.getItem(KEY);if(s)db=JSON.parse(s)}catch(e){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
  var $=function(id){return document.getElementById(id)};
  var BASE="https://medicalalert.example/e/";

  function esc(t){var d=document.createElement("div");d.textContent=t==null?"":String(t);return d.innerHTML}
  function say(el,text,cls){el.innerHTML='<div class="msg '+cls+'">'+esc(text)+'</div>'}
  function newToken(){var a=new Uint8Array(18);crypto.getRandomValues(a);return Array.from(a,function(b){return "abcdefghjkmnpqrstuvwxyz23456789"[b%31]}).join("")}
  function now(){return new Date().toLocaleString()}

  /* tabs */
  function show(tab){
    ["patient","responder","audit"].forEach(function(t){
      $(t).classList.toggle("hidden",t!==tab);
      $("t-"+t).setAttribute("aria-selected",t===tab);
    });
    if(tab==="audit")renderLog();
  }
  document.querySelectorAll("nav button").forEach(function(b){b.onclick=function(){show(b.dataset.tab)}});

  /* patient */
  var F=["name","blood","dob","allergies","conditions","meds","implants","ecname","ecphone"];
  function fillForm(){
    if(db.profile)F.forEach(function(k){$(k).value=db.profile[k]||""});
    if(db.consent){$("c-basic").checked=db.consent.basic;$("c-full").checked=db.consent.full;$("c-notify").checked=db.consent.notify;$("c-agree").checked=true}
    drawQR();
  }
  function drawQR(){
    if(!db.token){$("qrpanel").classList.add("hidden");return}
    $("qrpanel").classList.remove("hidden");
    var url=BASE+db.token;
    $("link").textContent=url;
    $("consent-stamp").textContent="Consent recorded "+db.consent.when+".";
    $("qr").innerHTML="";
    try{new QRCode($("qr"),{text:url,width:180,height:180})}catch(e){$("qr").textContent="QR library could not load. Use the link instead."}
  }
  $("save").onclick=function(){
    var m=$("p-msg");
    if(!$("name").value.trim()){say(m,"Enter your name to continue.","bad");return}
    if(!$("c-agree").checked){say(m,"Tick the agreement box so we can record your consent.","bad");return}
    db.profile={};F.forEach(function(k){db.profile[k]=$(k).value.trim()});
    db.profile.updated=new Date().toLocaleDateString();
    db.consent={basic:$("c-basic").checked,full:$("c-full").checked,notify:$("c-notify").checked,when:now()};
    if(!db.token)db.token=newToken();
    save();drawQR();
    say(m,"Saved. Your QR code is ready below.","ok");
    $("qrpanel").scrollIntoView({behavior:"smooth",block:"nearest"});
  };
  $("demo").onclick=function(){
    var d={name:"Amina Wanjiru",blood:"O+",dob:"1991-04-12",allergies:"Penicillin (severe), latex",conditions:"Type 1 diabetes, asthma",meds:"Insulin, salbutamol inhaler",implants:"None",ecname:"Joseph Kamau",ecphone:"+254 700 000 000"};
    F.forEach(function(k){$(k).value=d[k]});
    $("c-agree").checked=true;
    say($("p-msg"),"Demo patient filled in. Select Save and create QR code.","ok");
  };
  $("regen").onclick=function(){db.token=newToken();save();drawQR();say($("p-msg"),"New code created. The old one no longer works.","ok")};
  $("revoke").onclick=function(){db.token=null;save();drawQR();say($("p-msg"),"Code revoked. Scans of the old code will now fail.","ok")};
  $("go-scan").onclick=function(){$("token").value=BASE+db.token;show("responder")};

  /* responder */
  $("bg").onchange=function(){$("bg-reason").classList.toggle("hidden",!$("bg").checked)};
  function logIt(role,access,detail){
    db.log.unshift({t:now(),role:role,access:access,detail:detail});save();
  }
  $("open").onclick=function(){
    var m=$("r-msg"),res=$("result");res.innerHTML="";
    var raw=$("token").value.trim(),tok=raw.split("/").pop();
    var role=$("role").value,reg=$("regno").value.trim(),bg=$("bg").checked,reason=$("reason").value.trim();
    if(!tok){say(m,"Paste the QR link or code first.","bad");return}
    if(!db.token||tok!==db.token){logIt(role,"Failed","Unknown or revoked code");say(m,"This code is not valid. It may have been replaced or revoked.","bad");return}
    var verified=!!reg;
    if(!verified&&!bg){say(m,"Enter your registration number to be verified, or use the emergency override.","bad");return}
    if(!verified&&bg&&!reason){say(m,"Give a reason for the override. It is recorded.","bad");return}
    var level=verified?(db.consent.full?"full":"basic"):"basic";
    if(!verified&&!db.consent.basic){logIt(role,"Denied","Override without basic consent");say(m,"The patient has not allowed access without verification.","bad");return}
    logIt(role,verified?"Verified ("+level+")":"Override (basic)",verified?"Reg. no. "+reg:"Reason: "+reason);
    say(m,verified?"Verified. Showing what the patient allowed.":"Override recorded. Showing basic details only.","ok");
    var p=db.profile;
    var h='<div class="card"><div class="allergy"><small>Allergies</small><strong>'+esc(p.allergies||"None recorded")+'</strong></div><dl>'
      +'<dt>Name</dt><dd>'+esc(p.name)+'</dd><dt>Blood group</dt><dd>'+esc(p.blood)+'</dd>'
      +'<dt>Emergency contact</dt><dd>'+esc(p.ecname)+' '+esc(p.ecphone)+'</dd>';
    if(level==="full")h+='<dt>Conditions</dt><dd>'+esc(p.conditions||"None recorded")+'</dd><dt>Medication</dt><dd>'+esc(p.meds||"None recorded")+'</dd><dt>Implants or devices</dt><dd>'+esc(p.implants||"None recorded")+'</dd>';
    else h+='<dt>More details</dt><dd>Conditions and medication need a verified professional login.</dd>';
    h+='</dl><div class="stamp">Profile last updated '+esc(p.updated)+'. Check against the patient’s condition.</div></div>';
    res.innerHTML=h;
  };

  /* audit */
  function renderLog(){
    $("log").innerHTML=db.log.map(function(r){return "<tr><td>"+esc(r.t)+"</td><td>"+esc(r.role)+"</td><td>"+esc(r.access)+"</td><td>"+esc(r.detail)+"</td></tr>"}).join("");
    $("log-empty").classList.toggle("hidden",db.log.length>0);
    var ok=db.log.filter(function(r){return r.access.indexOf("Failed")<0&&r.access.indexOf("Denied")<0});
    $("notify").innerHTML=(db.consent&&db.consent.notify&&ok.length&&db.profile)?'<div class="msg ok">'+esc("Text sent to "+db.profile.ecname+" ("+db.profile.ecphone+"): "+db.profile.name+"’s medical profile was viewed on "+ok[0].t+".")+' (Simulated)</div>':"";
  }

  fillForm();
})();
