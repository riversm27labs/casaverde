export const LEVELS = [{id:'basico',name:'Básico'},{id:'intermediario',name:'Intermediário'},{id:'premium',name:'Premium'}];
export const SERVICE_NAMES = [{id:'jardinagem',name:'Jardinagem'},{id:'manutencao',name:'Manutenção'},{id:'plantio',name:'Plantio'},{id:'ornamentacao',name:'Ornamentação'},{id:'paisagismo',name:'Paisagismo'}];
export function emptyServiceConfig() {
  return {services:SERVICE_NAMES.map(service=>({...service,enabled:true,basePrice:null,pricePerM2:null,minimum:null,areaBands:[],requiresVisit:true,description:''})),levels:LEVELS.map(level=>({...level,multiplier:null})),materials:[],addons:[],regions:[],frequencies:[{id:'pontual',name:'Pontual',multiplier:null}],discounts:[],validityDays:null,paymentTerms:'',observations:''};
}
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
function number(value,label,{nullable=true,min=0,max=1e7}={}) {
  if(nullable&&(value===null||value===undefined||value===''))return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(label+' inválido.');
  return value;
}
function list(value,label,mapper) {
  if(!Array.isArray(value)||value.length>40)throw Error(label+': informe até 40 itens.');
  const ids=new Set();return value.map(item=>{
    if(!item||typeof item!=='object'||!/^[a-z0-9_-]{1,64}$/.test(item.id)||ids.has(item.id)||!text(item.name,120))throw Error(label+': identificador ou nome inválido/repetido.');
    ids.add(item.id);return {id:item.id,name:text(item.name,120),...mapper(item)};
  });
}
export function validateServiceConfig(input) {
  if(!input||typeof input!=='object')throw Error('Tabela inválida.');
  const config={
    services:list(input.services,'Serviços',s=>({enabled:!!s.enabled,description:text(s.description,1000),basePrice:number(s.basePrice,'Preço-base'),pricePerM2:number(s.pricePerM2,'Preço por m²'),minimum:number(s.minimum,'Valor mínimo'),requiresVisit:!!s.requiresVisit,areaBands:(()=>{
      if(!Array.isArray(s.areaBands)||s.areaBands.length>20)throw Error('Faixas de área inválidas.');
      let previous=0;return s.areaBands.map(band=>{const upTo=number(band.upTo,'Limite da faixa',{nullable:false,min:.01,max:1e6});if(upTo<=previous)throw Error('Faixas devem ter limites crescentes.');previous=upTo;return {upTo,pricePerM2:number(band.pricePerM2,'Preço da faixa',{nullable:false})};});
    })()})),
    levels:list(input.levels,'Níveis',s=>({multiplier:number(s.multiplier,'Multiplicador',{min:.01,max:20})})),
    regions:list(input.regions,'Regiões',s=>({fee:number(s.fee,'Deslocamento')})),
    frequencies:list(input.frequencies,'Frequências',s=>({multiplier:number(s.multiplier,'Multiplicador de frequência',{min:.01,max:20})})),
    discounts:list(input.discounts,'Descontos',s=>({percent:number(s.percent,'Desconto',{nullable:false,max:100}),enabled:!!s.enabled})),
    validityDays:number(input.validityDays,'Validade',{min:1,max:365}),paymentTerms:text(input.paymentTerms,2000),observations:text(input.observations,3000)
  };
  if(config.validityDays!==null&&!Number.isInteger(config.validityDays))throw Error('Validade deve ser um número inteiro de dias.');
  if(config.levels.length!==3||LEVELS.some(level=>!config.levels.some(row=>row.id===level.id)))throw Error('Configure os três níveis de execução.');
  for(const kind of ['materials','addons'])config[kind]=list(input[kind],kind==='materials'?'Materiais':'Adicionais',s=>({unit:text(s.unit,30)||'unidade',price:number(s.price,'Preço do item'),mode:s.mode==='per_m2'?'per_m2':'fixed',enabled:!!s.enabled}));
  return config;
}
const cents=value=>Math.round((value+Number.EPSILON)*100);
function selection(input,choices,label) {
  if(!Array.isArray(input)||input.length>30)throw Error(label+' inválidos.');
  const ids=new Set();return input.map(row=>{if(!row||ids.has(row.id))throw Error(label+' repetidos.');ids.add(row.id);const item=choices.find(choice=>choice.id===row.id&&choice.enabled);if(!item)throw Error(label+' não disponíveis.');return {id:item.id,qty:number(row.qty,'Quantidade',{nullable:false,min:.01,max:10000})};});
}
export function calculateServiceQuote(config,input) {
  const table=config||emptyServiceConfig();
  const service=table.services.find(item=>item.id===input.serviceId&&item.enabled);
  if(!service)throw Error('Selecione um serviço disponível.');
  const area=number(input.area,'Área',{nullable:false,min:.01,max:1e6});
  const level=table.levels.find(item=>item.id===input.levelId);if(!level)throw Error('Selecione o nível de execução.');
  const location=text(input.location,300);if(!location)throw Error('Informe a localização do atendimento.');
  const region=table.regions.find(item=>item.id===input.regionId);
  const frequency=table.frequencies.find(item=>item.id===input.frequencyId)||(!table.frequencies.length&&input.frequencyId==='pontual'?{id:'pontual',name:'Pontual',multiplier:null}:null);if(!frequency)throw Error('Selecione a frequência.');
  if(input.regionId&&!region)throw Error('Região inválida.');
  const materials=selection(input.materials||[],table.materials,'Materiais'),addons=selection(input.addons||[],table.addons,'Adicionais');
  const discount=input.discountId?table.discounts.find(item=>item.id===input.discountId&&item.enabled):null;
  if(input.discountId&&!discount)throw Error('Desconto não autorizado.');
  const request={serviceId:service.id,area,levelId:level.id,location,regionId:region?.id||'',frequencyId:frequency.id,materials,addons,discountId:discount?.id||''};
  const reasons=[];
  const band=service.areaBands.find(item=>area<=item.upTo);
  const rate=service.areaBands.length?band?.pricePerM2:service.pricePerM2;
  if(!config)reasons.push('Tabela comercial ainda não publicada.');
  if(service.basePrice===null||rate===null||rate===undefined||service.minimum===null)reasons.push('O serviço ou esta faixa de área exige avaliação de preço.');
  if(level.multiplier===null||frequency.multiplier===null)reasons.push('Nível ou frequência sem regra comercial.');
  if(!region||region.fee===null)reasons.push('Deslocamento para esta região precisa de avaliação.');
  if(!table.validityDays||!table.paymentTerms)reasons.push('Validade ou condições de pagamento pendentes.');
  for(const [rows,choices]of [[materials,table.materials],[addons,table.addons]])for(const row of rows)if(choices.find(item=>item.id===row.id).price===null)reasons.push('Um complemento está sem preço cadastrado.');
  const requestedItems=[];
  for(const [rows,choices]of [[materials,table.materials],[addons,table.addons]])for(const row of rows){const item=choices.find(choice=>choice.id===row.id);requestedItems.push({name:item.name,quantity:row.qty*(item.mode==='per_m2'?area:1),unit:item.unit});}
  const base={request,requestedItems,serviceName:service.name,serviceDescription:service.description,levelName:level.name,frequencyName:frequency.name,regionName:region?.name||'A avaliar',requiresVisit:service.requiresVisit,reasons,lines:[],subtotal:null,discount:0,total:null,status:'aguardando avaliação',validityDays:table.validityDays,paymentTerms:table.paymentTerms,observations:table.observations};
  if(reasons.length)return base;
  const lines=[];
  const add=(description,quantity,unit,unitPrice,amount)=>lines.push({description,quantity,unit,unitPrice,amount:amount/100});
  const baseCents=cents(service.basePrice),areaCents=cents(rate*area);
  add('Preço-base: '+service.name,1,'serviço',service.basePrice,baseCents);
  add('Execução por área'+(band?' · faixa até '+band.upTo+' m²':''),area,'m²',rate,areaCents);
  const execution=Math.round((baseCents+areaCents)*level.multiplier*frequency.multiplier);
  const adjustment=execution-baseCents-areaCents;
  if(adjustment)add(`Ajuste: ${level.name} ×${level.multiplier} · ${frequency.name} ×${frequency.multiplier}`,1,'ajuste',adjustment/100,adjustment);
  const minimum=Math.max(0,cents(service.minimum)-execution);if(minimum)add('Complemento para valor mínimo do serviço',1,'ajuste',minimum/100,minimum);
  for(const [rows,choices]of [[materials,table.materials],[addons,table.addons]])for(const row of rows){const item=choices.find(choice=>choice.id===row.id),quantity=row.qty*(item.mode==='per_m2'?area:1);add(item.name,quantity,item.unit,item.price,cents(quantity*item.price));}
  add('Deslocamento: '+region.name,1,'região',region.fee,cents(region.fee));
  const subtotal=lines.reduce((sum,line)=>sum+cents(line.amount),0);
  if(!Number.isSafeInteger(subtotal)||subtotal>1e10)throw Error('O projeto excede o limite do cálculo automático. Solicite avaliação técnica.');
  const discountCents=discount?Math.round(subtotal*discount.percent/100):0,total=subtotal-discountCents;
  if(total>1e10)throw Error('O projeto excede o limite do cálculo automático. Solicite avaliação técnica.');
  if(discountCents)add('Desconto autorizado: '+discount.name+' ('+discount.percent+'%)',1,'desconto',-discountCents/100,-discountCents);
  return {...base,lines,subtotal:subtotal/100,discount:discountCents/100,total:total/100,status:service.requiresVisit?'aguardando avaliação':'estimativo'};
}
