const express=require("express"),http=require("http"),{Server}=require("socket.io");
const TOKEN=process.env.ADMIN_TOKEN;
if(!TOKEN){console.error("Set ADMIN_TOKEN first, e.g.  ADMIN_TOKEN=mysecret node server.js");process.exit(1)}
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.json());app.use(express.static(__dirname+"/public"));
app.get("/admin",(q,r)=>r.sendFile(__dirname+"/public/admin.html"));
const S={mode:"queue",queue:[],min:1.1,max:10,wait:8,log:[],phase:"wait",next:null};
const K=0.12;
function pick(){
  let v;
  if(S.mode==="queue"&&S.queue.length)v=Number(S.queue.shift());
  else if(S.mode==="range")v=S.min+Math.random()*(S.max-S.min);
  else v=Math.floor(97/(1-Math.random()))/100;
  return Math.round(Math.min(1000,Math.max(1,v||1))*100)/100;
}
function round(){
  S.phase="wait";
  setTimeout(()=>{
    const cp=pick();S.phase="run";S.next=null;
    io.emit("start",{});
    setTimeout(()=>{
      S.log.unshift(cp);S.log=S.log.slice(0,30);
      io.emit("crash",{v:cp});round();
    },Math.max(300,Math.log(cp)/K*1000));
  },S.wait*1000);
}
function auth(q,r,n){q.get("x-admin-token")===TOKEN?n():r.status(401).json({error:"bad token"})}
const clean=a=>(a||[]).map(Number).filter(n=>n>=1&&isFinite(n)).map(n=>Math.round(Math.min(1000,n)*100)/100);
app.get("/api/state",auth,(q,r)=>r.json(S));
app.post("/api/queue",auth,(q,r)=>{const n=clean(q.body.nums);S.queue=q.body.front?n.concat(S.queue):S.queue.concat(n);r.json(S)});
app.delete("/api/queue/:i",auth,(q,r)=>{S.queue.splice(+q.params.i,1);r.json(S)});
app.post("/api/queue/clear",auth,(q,r)=>{S.queue=[];r.json(S)});
app.post("/api/config",auth,(q,r)=>{const b=q.body;
  if(["queue","range","random"].includes(b.mode))S.mode=b.mode;
  S.min=Math.max(1,+b.min||1);S.max=Math.max(S.min,+b.max||10);S.wait=Math.min(60,Math.max(5,+b.wait||8));r.json(S)});
io.on("connection",s=>{s.emit("history",S.log);if(S.phase==="run")s.emit("start",{})});
round();
srv.listen(process.env.PORT||3000,()=>console.log("MH333 running on port "+(process.env.PORT||3000)));
