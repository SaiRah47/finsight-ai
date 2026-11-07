import type {LabeledRetrievalCase} from '../../lib/retrieval-evaluation.ts';

/**
 * SYNTHETIC fictional SEC-style fixture documents.
 * These are NOT actual SEC disclosures, and scores must not be described
 * as real-world SEC retrieval accuracy.
 */
const block=(heading:string,content:string)=>'<h2>'+heading+'</h2><p>'+content+'</p>';
const filler='The registrant provides general corporate disclosures and operational background. '.repeat(11);
const caseHtml=(one:string,two:string,three:string)=>'<html><head><title>Mock filing — synthetic only</title></head><body>'+
 block('Item 1. Business',filler+' Product development and operations. '+one+filler)+
 block('Item 1A. Risk Factors',filler+' Potential changes could affect operations. '+two+filler)+
 block('Item 7. Management Discussion',filler+' Results discussion. '+three+filler)+'</body></html>';

export const SEC_RETRIEVAL_CASES:LabeledRetrievalCase[]=[
 {id:'cybersecurity',question:'What cybersecurity exposure is disclosed in risk factors?',
  documentHtml:caseHtml('The company supports general-purpose cloud operations.',
   'Unauthorized access to customer records could trigger cybersecurity incident response costs.',
   'Revenue increased because of expanded distribution.'),
  expectedText:'Unauthorized access to customer records could trigger cybersecurity incident response costs.'},
 {id:'supply-chain',question:'What supply chain disruption risk is described?',
  documentHtml:caseHtml('We source critical components from third-party manufacturers.',
   'Single-source semiconductor suppliers could disrupt product deliveries after a fabrication outage.',
   'Operating expenses include research spending.'),
  expectedText:'Single-source semiconductor suppliers could disrupt product deliveries after a fabrication outage.'},
 {id:'competition',question:'What competitive pricing pressure is reported?',
  documentHtml:caseHtml('The company sells technology hardware.',
   'Competitive discounting from lower-priced rivals could compress gross margins.',
   'Revenue growth followed an increase in sales volume.'),
  expectedText:'Competitive discounting from lower-priced rivals could compress gross margins.'},
 {id:'liquidity',question:'What liquidity and debt obligation risk exists?',
  documentHtml:caseHtml('The business serves enterprise clients.',
   'Scheduled debt maturities may reduce liquidity available for operating investment.',
   'Results reflect changes in demand.'),
  expectedText:'Scheduled debt maturities may reduce liquidity available for operating investment.'},
 {id:'revenue',question:'What is disclosed about data center revenue growth?',
  documentHtml:caseHtml('Products include accelerator cards.',
   'Changing customer demand can affect margins.',
   'Data center revenue growth was associated with increased accelerator platform shipments.'),
  expectedText:'Data center revenue growth was associated with increased accelerator platform shipments.'},
 {id:'margin',question:'What pressures on gross margin were reported?',
  documentHtml:caseHtml('Production uses external assembly partners.',
   'Higher component costs and unfavorable product mix could reduce gross margin.',
   'Quarterly revenue was seasonal.'),
  expectedText:'Higher component costs and unfavorable product mix could reduce gross margin.'},
 {id:'cash',question:'How did operating cash flow change?',
  documentHtml:caseHtml('We deliver enterprise systems.',
   'Customers may delay purchases.',
   'Operating cash flow increased after collections of outstanding receivables.'),
  expectedText:'Operating cash flow increased after collections of outstanding receivables.'},
 {id:'security-over-risk-noise',question:'Describe the specific cybersecurity breach and access controls risk.',
  documentHtml:caseHtml('General corporate overview.',
   'Generic risk factors and operational risk considerations. '.repeat(23)+
   ' Weak access controls could enable an unauthorized data breach affecting customer accounts.',
   'General cost estimates are preliminary.'),
  expectedText:'Weak access controls could enable an unauthorized data breach affecting customer accounts.'},
 {id:'negative-astronomy',question:'What does this filing say about stellar nebulae and quasars?',
  documentHtml:caseHtml('We offer consumer devices.','Operational constraints relate to factories.','Sales volumes increased.'),
  expectedText:null},
 {id:'negative-cryptography',question:'What are the elliptic curve cryptography parameters?',
  documentHtml:caseHtml('We manufacture consumer devices.','Potential shipping disruptions affect operations.','Sales volumes changed.'),
  expectedText:null},
 {id:'negative-food',question:'What is the gluten-free bakery recipe?',
  documentHtml:caseHtml('Corporate business overview.','We discuss ordinary operational matters.','Revenue was seasonally variable.'),
  expectedText:null}
];
