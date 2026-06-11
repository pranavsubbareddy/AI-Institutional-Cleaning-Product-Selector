require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { generateRecommendation, PRODUCT_KNOWLEDGE_BASE } = require('./src/engine/recommendationEngine');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({origin:true,credentials:true}));
app.use(express.json());
app.use(morgan('dev'));

const INST = [];
const RECS = [];
const ITEMS = []; // Recommendation items stored separately
const PRODUCTS = PRODUCT_KNOWLEDGE_BASE.products;
const SKU = {'prod-gpc-001':'GPC-5L-001','prod-dsf-002':'HDS-5L-002','prod-gls-003':'GLS-5L-003','prod-flr-004':'FLR-5L-004','prod-crp-005':'CRP-5L-005','prod-stl-006':'STL-5L-006','prod-wpd-007':'WPD-5L-007','prod-tlt-008':'TLT-5L-008','prod-hnd-009':'HND-5L-009','prod-hdd-010':'HDD-5L-010','prod-bio-011':'BIO-5L-011','prod-air-012':'AIR-5L-012'};

// Health
app.get('/api/health', (req, res) => res.json({success:true,message:'API Running',version:'1.0.0',timestamp:new Date().toISOString()}));

// Products
app.get('/api/products', (req, res) => {
  let p = [...PRODUCTS];
  if(req.query.category) p = p.filter(x => x.category === req.query.category);
  if(req.query.surface_type) p = p.filter(x => x.surface_types.includes(req.query.surface_type));
  if(req.query.hygiene_level) p = p.filter(x => x.hygiene_level === req.query.hygiene_level);
  res.json({success:true,count:p.length,data:p,timestamp:new Date().toISOString()});
});
app.get('/api/products/:id', (req, res) => {
  const p = PRODUCTS.find(x => x.id === req.params.id);
  if(!p) return res.status(404).json({success:false,error:'Not found',timestamp:new Date().toISOString()});
  res.json({success:true,data:p,timestamp:new Date().toISOString()});
});

// Institutions
app.post('/api/institutions', (req, res) => {
  const {name,institution_type,area_size,surface_types,hygiene_standard,budget,contact_name,contact_email,contact_phone,address} = req.body;
  const errs = [];
  if(!name||name.trim().length<2) errs.push('Name required (min 2)');
  if(!['hospital','school','hotel','office','restaurant','factory','warehouse','retail'].includes(institution_type)) errs.push('Invalid type');
  if(!area_size||isNaN(Number(area_size))||Number(area_size)<=0) errs.push('Area must be positive');
  if(!surface_types||!Array.isArray(surface_types)||surface_types.length===0) errs.push('Surface types required');
  if(errs.length) return res.status(400).json({success:false,error:'Validation failed',details:errs,timestamp:new Date().toISOString()});

  const i = {id:uuidv4(),name:name.trim(),institution_type,area_size:Number(area_size),surface_types,hygiene_standard:hygiene_standard||'standard',budget:budget||'medium',contact_name:contact_name||null,contact_email:contact_email||null,contact_phone:contact_phone||null,address:address||null,status:'active',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  INST.push(i);
  res.status(201).json({success:true,message:'Created',data:i,timestamp:new Date().toISOString()});
});
app.get('/api/institutions', (req, res) => {
  let f = [...INST];
  if(req.query.status) f = f.filter(x => x.status === req.query.status);
  if(req.query.type) f = f.filter(x => x.institution_type === req.query.type);
  const pg = parseInt(req.query.page)||1, lim = Math.min(parseInt(req.query.limit)||10,100);
  const tot = f.length, st = (pg-1)*lim;
  res.json({success:true,count:f.slice(st,st+lim).length,total:tot,page:pg,totalPages:Math.ceil(tot/lim),data:f.slice(st,st+lim),timestamp:new Date().toISOString()});
});
app.get('/api/institutions/:id', (req, res) => {
  const i = INST.find(x => x.id === req.params.id);
  if(!i) return res.status(404).json({success:false,error:'Not found',timestamp:new Date().toISOString()});
  const rs = RECS.filter(r => r.institution_id === req.params.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  res.json({success:true,data:{...i,recommendations:rs},timestamp:new Date().toISOString()});
});
app.put('/api/institutions/:id', (req, res) => {
  const idx = INST.findIndex(x => x.id === req.params.id);
  if(idx===-1) return res.status(404).json({success:false,error:'Not found',timestamp:new Date().toISOString()});
  ['name','institution_type','area_size','surface_types','hygiene_standard','budget','contact_name','contact_email','contact_phone','address','status'].forEach(k => {if(req.body[k]!==undefined) INST[idx][k]=req.body[k]});
  INST[idx].updated_at = new Date().toISOString();
  res.json({success:true,message:'Updated',data:INST[idx],timestamp:new Date().toISOString()});
});
app.delete('/api/institutions/:id', (req, res) => {
  const idx = INST.findIndex(x => x.id === req.params.id);
  if(idx===-1) return res.status(404).json({success:false,error:'Not found',timestamp:new Date().toISOString()});
  INST.splice(idx,1);
  res.json({success:true,message:'Deleted',timestamp:new Date().toISOString()});
});

// Recommendations
app.post('/api/recommendations/process', async (req, res, next) => {
  try {
    const {institutionId} = req.body;
    if(!institutionId) return res.status(400).json({success:false,error:'institutionId required',timestamp:new Date().toISOString()});
    const i = INST.find(x => x.id === institutionId);
    if(!i) return res.status(404).json({success:false,error:'Not found',timestamp:new Date().toISOString()});

    const result = generateRecommendation({institution_type:i.institution_type,area_size:i.area_size,surface_types:i.surface_types,hygiene_standard:i.hygiene_standard,budget:i.budget});
    const rid = uuidv4();
    const items = result.items.map(item => ({id:uuidv4(),recommendation_id:rid,product_id:item.product_id,product_name:item.product_name,category:item.category,sku:SKU[item.product_id]||item.product_id,quantity_estimate:item.quantity_estimate,unit:item.unit,dilution_ratio:item.dilution_ratio,monthly_cost:item.monthly_cost,unit_price:item.unit_price,coverage_per_unit:item.coverage_per_unit,usage_frequency:item.usage_frequency,priority:item.priority,usage_guidance:item.usage_guidance,safety_notes:item.safety_notes,base_price:item.unit_price}));

    const rec = {id:rid,institution_id:i.id,status:'Processed',total_estimated_cost:result.total_estimated_cost,monthly_total_quantity:result.monthly_total_quantity,summary:result.summary,alerts:JSON.stringify(result.alerts),source:'Rule_Engine',owner:'system',processed_at:new Date().toISOString(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    RECS.push(rec);
    // Store items separately so they can be retrieved by ID
    items.forEach(item => ITEMS.push(item));

    res.status(201).json({success:true,message:'Processed',data:{recommendation:{...rec,alerts:result.alerts},items,institution_id:i.id,institution_name:i.name,summary:result.summary,grossAggregatedCost:result.total_estimated_cost,financialStatusAlert:result.alerts.length>0?result.alerts.join('; '):null},timestamp:new Date().toISOString()});
  } catch(e) { next(e); }
});

app.get('/api/recommendations', (req, res) => {
  let f = RECS.map(r => {const inst=INST.find(i=>i.id===r.institution_id); return{...r,institution_name:inst?.name||'Unknown',institution_type:inst?.institution_type||'unknown',alerts:JSON.parse(r.alerts||'[]')};});
  if(req.query.status) f = f.filter(r=>r.status===req.query.status);
  const pg=parseInt(req.query.page)||1,lim=Math.min(parseInt(req.query.limit)||10,100),tot=f.length,st=(pg-1)*lim;
  res.json({success:true,count:f.slice(st,st+lim).length,total:tot,page:pg,totalPages:Math.ceil(tot/lim),data:f.slice(st,st+lim),timestamp:new Date().toISOString()});
});

app.get('/api/recommendations/:id', (req, res) => {
  const rec = RECS.find(r=>r.id===req.params.id);
  if(!rec) return res.status(404).json({success:false,error:'Not found',timestamp:new Date().toISOString()});
  const inst = INST.find(i=>i.id===rec.institution_id);
  // Retrieve stored items, or regenerate from the recommendation engine if none found
  let items = ITEMS.filter(item => item.recommendation_id === req.params.id);
  if (items.length === 0 && inst) {
    // Re-compute using the engine
    const result = generateRecommendation({institution_type:inst.institution_type,area_size:inst.area_size,surface_types:inst.surface_types,hygiene_standard:inst.hygiene_standard,budget:inst.budget});
    items = result.items.map(item => ({id:uuidv4(),recommendation_id:req.params.id,product_id:item.product_id,product_name:item.product_name,category:item.category,sku:SKU[item.product_id]||item.product_id,quantity_estimate:item.quantity_estimate,unit:item.unit,dilution_ratio:item.dilution_ratio,monthly_cost:item.monthly_cost,unit_price:item.unit_price,coverage_per_unit:item.coverage_per_unit,usage_frequency:item.usage_frequency,priority:item.priority,usage_guidance:item.usage_guidance,safety_notes:item.safety_notes,base_price:item.unit_price}));
    items.forEach(item => ITEMS.push(item));
  }
  res.json({success:true,data:{...rec,institution_name:inst?.name||'Unknown',institution_type:inst?.institution_type||'unknown',area_size:inst?.area_size||0,hygiene_standard:inst?.hygiene_standard||'standard',budget:inst?.budget||'medium',surface_types:inst?.surface_types||[],alerts:JSON.parse(rec.alerts||'[]'),items},timestamp:new Date().toISOString()});
});

// Dashboard
app.get('/api/dashboard/stats', (req, res) => {
  const typeMap={}; INST.forEach(i=>{typeMap[i.institution_type]=(typeMap[i.institution_type]||0)+1});
  const statusMap={}; RECS.forEach(r=>{statusMap[r.status]=(statusMap[r.status]||0)+1});
  const hygMap={}; INST.forEach(i=>{hygMap[i.hygiene_standard]=(hygMap[i.hygiene_standard]||0)+1});
  const budMap={}; INST.forEach(i=>{budMap[i.budget]=(budMap[i.budget]||0)+1});
  res.json({success:true,data:{overview:{total_institutions:INST.length,total_recommendations:RECS.length,total_products:PRODUCTS.length,total_orders:0,total_estimated_cost:RECS.filter(r=>r.status==='Processed').reduce((s,r)=>s+(r.total_estimated_cost||0),0),active_recommendations:RECS.filter(r=>['Processed','Pending_AI'].includes(r.status)).length},institutions_by_type:Object.entries(typeMap).map(([k,v])=>({institution_type:k,count:v})),recommendations_by_status:Object.entries(statusMap).map(([k,v])=>({status:k,count:v})),hygiene_stats:Object.entries(hygMap).map(([k,v])=>({hygiene_standard:k,count:v})),budget_stats:Object.entries(budMap).map(([k,v])=>({budget:k,count:v})),recent_recommendations:[...RECS].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,10).map(r=>{const inst=INST.find(i=>i.id===r.institution_id);return{...r,institution_name:inst?.name||'Unknown',institution_type:inst?.institution_type||'unknown'}})},timestamp:new Date().toISOString()});
});

app.get('/api/dashboard/institutions', (req, res) => {
  const data = INST.map(i => {const rs=RECS.filter(r=>r.institution_id===i.id);const l=rs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];return{...i,recommendation_count:rs.length,latest_cost:l?.total_estimated_cost||null,latest_status:l?.status||null,latest_recommendation_date:l?.created_at||null}}).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  res.json({success:true,count:data.length,data,timestamp:new Date().toISOString()});
});

app.get('/api/dashboard/summary', (req, res) => {
  const logs = [...RECS].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,20).map(r=>{const inst=INST.find(i=>i.id===r.institution_id);return{...r,institution_name:inst?.name||'Unknown',institution_type:inst?.institution_type||'unknown',iso_timestamp:new Date(r.created_at).toISOString()};});
  res.json({success:true,data:{total_profiles_created:INST.length,total_calculated_volume_inr:RECS.filter(r=>r.status==='Processed').reduce((s,r)=>s+(r.total_estimated_cost||0),0),active_recommendations:RECS.filter(r=>['Processed','Pending_AI','Draft'].includes(r.status)).length,history_logs:logs},timestamp:new Date().toISOString()});
});

// 404 & Error
app.use((req, res) => res.status(404).json({success:false,error:'Route not found',path:req.originalUrl,timestamp:new Date().toISOString()}));
app.use((err, req, res, next) => {console.error(err);res.status(err.status||500).json({success:false,error:err.message||'Internal server error',details:process.env.NODE_ENV==='development'?err.stack:undefined,timestamp:new Date().toISOString()});});

app.listen(PORT, '0.0.0.0', () => console.log(`\n  Standalone API running on http://localhost:${PORT}\n`));
