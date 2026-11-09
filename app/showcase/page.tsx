import type {Metadata} from 'next';
import PublicShowcase from './PublicShowcase';
export const metadata:Metadata={
 title:'FinSight AI | Interactive Project Showcase',
 description:'Explore the architecture, evidence-first research workflow, and simulation-only multi-agent strategy arena behind FinSight AI. Public demonstration uses illustrative data only.',
 robots:{index:true,follow:true},
 openGraph:{title:'FinSight AI — Agentic Market Intelligence',description:'Interactive public project tour · multi-agent workflows · simulation-only competition',type:'website'}
};
export const dynamic='force-static';
export default function ShowcasePage(){return <PublicShowcase/>}
