import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToString } = require('react-dom/server');
const { build } = await import('vite');

await build({
  configFile: false,
  logLevel: 'error',
  ssr: true,
  build: {
    outDir: '.ssr-smoke',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        ctx: 'src/context/WorkspaceContext.jsx',
        shell: 'src/components/layout/AppShell.jsx',
        doc: 'src/components/canvas/TaskDocCanvas.jsx',
        slash: 'src/components/canvas/SlashCommandBar.jsx',
      },
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});

if (typeof globalThis.document === 'undefined') {
  globalThis.document = { activeElement: null, addEventListener() {}, removeEventListener() {} };
}

let pass = 0, fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name); ok ? pass++ : fail++; };

try {
  const ctxMod = await import('./.ssr-smoke/ctx.js');
  const shellMod = await import('./.ssr-smoke/shell.js');
  const docMod = await import('./.ssr-smoke/doc.js');
  const slashMod = await import('./.ssr-smoke/slash.js');
  const { WorkspaceProvider, useWorkspace } = ctxMod;
  const AppShell = shellMod.default;

  check('TaskDocCanvas module loads', !!docMod.default);
  check('SlashCommandBar module loads', !!slashMod.default);
  check('AppShell + Provider exported', typeof AppShell === 'function' && typeof WorkspaceProvider === 'function');

  const html = renderToString(React.createElement(WorkspaceProvider, null, React.createElement(AppShell)));
  check('AppShell SSR renders (stream mode)', html.length > 1000);
  check('Stream shows ENG-104 row', html.includes('ENG-104'));

  function Probe() {
    const ws = useWorkspace();
    const t = ws.tasks.find((x) => x.id === 'ENG-104');
    return JSON.stringify({
      hasObjective: typeof t.objective === 'string' && t.objective.length > 50,
      checklistCount: t.checklists.length,
      nestedIndent: t.checklists.some((c) => c.indent >= 1),
      criteriaCount: t.acceptanceCriteria.length,
      hasSnippet: !!t.codeSnippet,
      actionsOk: ['updateTaskMetadata','updateTaskObjective','toggleChecklistItem','addChecklistItem','indentChecklistItem','deleteChecklistItem','addAcceptanceRow','cycleAcceptanceStatus','decomposeTaskWithAI','cycleAssignee','insertChecklistItemAfter'].every((k) => typeof ws[k] === 'function'),
      allTasksEnriched: ws.tasks.every((x) => Array.isArray(x.checklists) && Array.isArray(x.acceptanceCriteria) && typeof x.objective === 'string'),
    });
  }
  const raw = renderToString(React.createElement(WorkspaceProvider, null, React.createElement(Probe)));
  const p = JSON.parse(raw.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&'));
  check('ENG-104 objective enriched', p.hasObjective);
  check('ENG-104 checklist seeded (4 items)', p.checklistCount === 4);
  check('Nested indent levels present', p.nestedIndent);
  check('Acceptance criteria seeded (2 rows)', p.criteriaCount === 2);
  check('Code snippet present', p.hasSnippet);
  check('All Step 4 mutation actions exposed', p.actionsOk);
  check('Every task carries spec fields', p.allTasksEnriched);
} catch (err) {
  console.error('SSR ERROR:', err);
  fail++;
} finally {
  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
