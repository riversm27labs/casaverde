import PDFDocument from 'pdfkit';
import {readFile} from 'node:fs/promises';
const brl=value=>value===null?'A avaliar':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
export async function serviceQuotePDF(quote){
  const doc=new PDFDocument({size:'A4',margin:44,bufferPages:true,info:{Title:quote.number+' — Casa Verde',Author:quote.company.name}});
  const chunks=[],finished=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  const logo=await readFile(new URL('../public/brand/casa-verde.png',import.meta.url));
  doc.image(logo,44,36,{fit:[85,72]});doc.fillColor('#174B35').font('Helvetica-Bold').fontSize(20).text('Orçamento de serviços',150,48);doc.fontSize(11).text(quote.company.name,150,76);doc.y=125;doc.x=44;
  const line=(label,value)=>{if(doc.y>735)doc.addPage();doc.font('Helvetica-Bold').fontSize(10).fillColor('#174B35').text(label,{continued:true});doc.font('Helvetica').fillColor('#263C2C').text(' '+value).moveDown(.5);};
  line('Número:',quote.number);line('Emissão:',new Date(quote.issuedAt).toLocaleString('pt-BR',{timeZone:'America/Araguaina'}));line('Status:',quote.status);line('Cliente:',quote.customer.name);line('Contato:',quote.customer.phone+(quote.customer.email?' · '+quote.customer.email:''));
  line('Serviço:',quote.serviceName);line('Medidas:',quote.request.area+' m² · '+quote.levelName+' · '+quote.frequencyName);line('Localização:',quote.request.location+' · '+quote.regionName);
  if(quote.serviceDescription)line('Descrição:',quote.serviceDescription);
  doc.moveDown().font('Helvetica-Bold').fontSize(12).text('Discriminação dos itens').moveDown(.5);
  if(!quote.lines.length)line('Avaliação técnica:',quote.reasons.join(' '));
  if(!quote.lines.length)for(const item of quote.requestedItems||[])line('Complemento solicitado:',`${item.name} · ${item.quantity} ${item.unit} · valor a avaliar`);
  for(const item of quote.lines)line(item.description+':',`${item.quantity} ${item.unit} × ${brl(item.unitPrice)} = ${brl(item.amount)}`);
  doc.moveDown();line('Total estimado:',brl(quote.total));line('Validade:',quote.expiresAt?new Date(quote.expiresAt).toLocaleDateString('pt-BR',{timeZone:'America/Araguaina'})+' ('+quote.validityDays+' dias)':'A definir pela empresa');
  line('Condições de pagamento:',quote.paymentTerms||'A definir após avaliação comercial.');
  if(quote.requiresVisit)line('Vistoria técnica:','Necessária antes da confirmação comercial.');
  if(quote.observations)line('Observações:',quote.observations);
  line('Tabela utilizada:',quote.versionId||'Sem tabela publicada — avaliação técnica');
  line('Importante:',quote.status==='aprovado pela empresa'?'Proposta comercial aprovada pela empresa. Não confirma execução, agendamento ou pagamento automático.':'Orçamento estimativo, sujeito à avaliação. Não confirma execução, agendamento ou pagamento. A aprovação pela empresa é registrada separadamente.');
  if(quote.company.address)line('Casa Verde:',quote.company.address);
  const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.font('Helvetica').fontSize(8).fillColor('#637168').text(quote.number+' · Página '+(i+1)+' de '+pages.count,44,790,{lineBreak:false});}
  doc.end();return finished;
}
