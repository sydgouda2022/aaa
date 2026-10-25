#!/usr/bin/env node
/** Pre-cutover audit for the original monorepo.
 * Fails on lost source assets, broken release authority or an invalid
 * four-project dependency DAG. Reports (does not conceal) integration debt.
 *
 * This is NOT proof that independent GitHub repositories already exist.
 */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const string=path=>read(path).toString('utf8');
const json=path=>JSON.parse(string(path));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseline=json('migration/four-streams.json');
assert.equal(baseline.schema,'four-streams-migration-v1');
assert.equal(baseline.state,'proposed-not-migrated');
assert.equal(baseline.migration_operation,'split_origin_repository_into_four_independent_repositories');
assert.equal(baseline.original_repo_must_survive_cutover,true);
assert.deepEqual(baseline.deletion_candidates,[
 'sydgouda2022/Object-Detection-in-an-Urban-Environment',
 'sydgouda2022/egypt-radio-gateway',
 'sydgouda2022/Udacity-Self-Driving-Car-Engineer-Nanodegree-Program-Sensor-Fusion-and-Tracking',
 'sydgouda2022/egyptian-radio-pwa'
]);
assert.equal(baseline.legacy_cleanup.includes_origin_repo,false);
assert(!baseline.deletion_candidates.includes(baseline.origin.repository),
 'Never delete the aaa migration source while splitting it');
const expected=['coptic-keyboard','hieroglyphic-keyboard','renpet','mdwnfr'];
assert.deepEqual(baseline.target_repositories.map(p=>p.name),expected);
const edges=baseline.dependency_edges.map(([from,to])=>from+'>'+to);
assert.deepEqual(edges,[
 'coptic-keyboard>renpet',
 'hieroglyphic-keyboard>renpet',
 'hieroglyphic-keyboard>mdwnfr'
]);
assert.equal(new Set(edges).size,edges.length);
for(const [source,target] of baseline.dependency_edges){
 assert(expected.includes(source)&&expected.includes(target));
 assert(source!==target);
}
const adjacency=new Map(expected.map(p=>[p,[]]));
for(const [source,target] of baseline.dependency_edges)adjacency.get(source).push(target);
const visited=new Set(),active=new Set();
function walk(node){
 if(active.has(node))throw Error('Cyclic keyboard dependency: '+node);
 if(visited.has(node))return;
 active.add(node);for(const child of adjacency.get(node))walk(child);
 active.delete(node);visited.add(node);
}
expected.forEach(walk);
const necessary=[
 'shared-language/src/compile_lexica.py',
 'shared-language/src/keyboard_search.mjs',
 'shared-language/src/coptic_install.mjs',
 'shared-language/src/lexicon_install.mjs',
 'shared-language/src/publish_compiled_coptic.py',
 'shared-language/src/publish_release.py',
 'shared-language/sources/late_egyptian_registry.json',
 'renpet/web/keyboard.js',
 'renpet/web/keyboard-core.js',
 'renpet/web/assets/dictionaries/coptic.json',
 'renpet/web/assets/dictionaries/coptic-popular.json',
 'renpet/tools/build_release.sh',
 'renpet/tests/keyboard.test.mjs',
 'mdwnfr/web/keyboard_catalog.js',
 'mdwnfr/data/lexicon.sqlite3',
 'mdwnfr/web/lexicon/lexicon.json',
 'mdwnfr/web/lexicon/manifest.json',
 'mdwnfr/core/mdwnfr/data/lexicon.json',
 'mdwnfr/qa/test_keyboard.py',
 '.github/workflows/deploy-renpet-pages.yml',
 '.github/workflows/deploy-mdwnfr.yml'
];
for(const p of necessary)assert(existsSync(new URL('../'+p,import.meta.url)),'Missing migration source: '+p);
const release=json('mdwnfr/web/lexicon/manifest.json');
const bytes=read('mdwnfr/web/lexicon/lexicon.json');
assert.equal(release.bytes,bytes.length);
assert.equal(release.sha256,hash(bytes));
assert.equal(release.sha256,baseline.current_baseline.egy_lexicon_sha256);
assert.equal(release.spelling_records,baseline.current_baseline.hieroglyphic_spelling_records);
assert.equal(release.language,'egy');
assert.equal(release.stage,'Late Egyptian');
assert.equal(hash(read('mdwnfr/core/mdwnfr/data/lexicon.json')),release.sha256,
 'Web and Python authority must be one identical verified pack');
const lexicon=JSON.parse(bytes.toString('utf8'));
assert.equal(lexicon.entries.length,release.spelling_records);
const coverage=json('mdwnfr/web/lexicon/coverage.json');
assert.equal(coverage.unique_native_surfaces,baseline.current_baseline.hieroglyphic_distinct_surfaces);
assert.equal(coverage.unique_spellings,release.spelling_records);
const build=string('renpet/tools/build_release.sh');
for(const [source,dest] of [
 ['keyboard_search.mjs','keyboard-search.mjs'],
 ['lexicon_install.mjs','lexicon-install.mjs'],
 ['coptic_install.mjs','coptic-install.mjs']
])assert(build.includes('cp shared-language/src/'+source+' renpet/web/'+dest),
 'Current Renpet keyboard source provenance is untracked: '+source);
const mdwnfrWorkflow=string('.github/workflows/deploy-mdwnfr.yml');
const renpetWorkflow=string('.github/workflows/deploy-renpet-pages.yml');
assert(renpetWorkflow.includes('shared-language/src/keyboard_search.mjs'),
 'Current Renpet release must watch its shared keyboard engine source');
const report={
 audit:'four-streams-original-baseline-v1',
 source_repository:baseline.origin.repository,
 source_baseline_commit:baseline.origin.baseline_commit,
 migration_state:baseline.state,
 separate_repositories_ready:false,
 downstream_auto_updates_ready:false,
 validated_paths:necessary.length,
 hierarchical_lexicon:{
   spelling_records:release.spelling_records,
   distinct_native_surfaces:coverage.unique_native_surfaces,
   verified_sha256:release.sha256,
   complete:release.complete
 },
 coptic_published_surfaces_baseline:baseline.current_baseline.coptic_distinct_surfaces,
 existing_renpet_shared_engine_copy_proven:true,
 mdwnfr_shared_source_trigger_present:mdwnfrWorkflow.includes("'shared-language/"),
 unresolved:[
  'Standalone repositories have not yet been created.',
  'Keyboard source remains mixed across shared-language, Renpet and MdwNfr.',
  'App copies do not yet use upstream versioned keyboard locks and releases.',
  'Coptic master is currently constructed in release CI, not a standalone keyboard repository.',
  'Cross-repository deployment credentials and Cloudflare ownership are not yet transferred.'
 ]
};
console.log(JSON.stringify(report,null,2));
