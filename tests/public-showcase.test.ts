import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync('app/showcase/page.tsx','utf8');
const experience=readFileSync('app/showcase/PublicShowcase.tsx','utf8');
const gate=readFileSync('app/components/AccessGate.tsx','utf8');
const css=readFileSync('app/showcase/showcase.module.css','utf8');

test('showcase route is statically rendered without private owner gate or server data',()=>{
 assert.match(page,/dynamic='force-static'/);
 assert.doesNotMatch(page,/authorizedOwner|browserDb|supabase|AccessGate|cookies\(|headers\(/i);
 assert.doesNotMatch(page,/getServerSideProps|fetch\(/i);
});
test('public interactive tour contains only authored illustrative examples',()=>{
 assert.doesNotMatch(experience,/fetch\(|\/api\/|SUPABASE_|SECRET|localStorage|document\.cookie/i);
 assert.match(experience,/illustrative/i);
 assert.match(experience,/simulation-only/i);
 assert.match(experience,/no account access|no real-money trading/i);
});
test('owner sign-in makes public tour discoverable without modifying auth gates',()=>{
 assert.match(gate,/href="\/showcase"/);
 assert.match(gate,/status==='denied'/);
 assert.match(gate,/authorized/);
});
test('mobile showcase uses accessible breakpoints and reduced-motion support',()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
