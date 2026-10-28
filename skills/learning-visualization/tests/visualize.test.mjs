import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve(import.meta.dirname, '..', 'scripts', 'visualize.mjs');

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function explainerPackage() {
  return {
    topic: '电流环已有解释',
    purpose: '看清两个已有例子与电流环概念的对应和边界',
    concepts: [{ id: 'c1', label: '电流环', explanation: '输入笔记中的解释' }],
    examples: [
      { id: 'e1', angle: '生活', title: '已有排队例子', content: '输入中的例子一', mapping: '输入中的对应一', boundary: '输入中的边界一' },
      { id: 'e2', angle: '代码', title: '已有代码例子', content: '输入中的例子二', mapping: '输入中的对应二', boundary: '输入中的边界二' }
    ],
    relations: [
      { from: 'e1', to: 'c1', meaning: '对应' },
      { from: 'e2', to: 'c1', meaning: '限制' }
    ],
    steps: [], sources: [], assets: [], confusions: ['两个例子的边界容易混淆'],
    visualization_request: { preferred_mode: 'explainer', interaction: 'step-through', allow_3d: false }
  };
}

test('单个定义不通过门禁且不创建文件', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-gate-'));
  const input = path.join(root, 'definition.json');
  writeJson(input, {
    topic: '单个定义', purpose: '查看定义',
    concepts: [{ id: 'c1', label: '定义', explanation: '只有一句定义' }],
    examples: [], relations: [], steps: [], sources: [], assets: [],
    visualization_request: { preferred_mode: 'auto', interaction: 'none', allow_3d: false }
  });
  const result = run(['validate', input]);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).gate, false);
  assert.deepEqual(fs.readdirSync(root), ['definition.json']);
});

test('多个例子生成可切换和高亮的解释页', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-explainer-'));
  const input = path.join(root, 'content.json');
  const out = path.join(root, 'topic');
  writeJson(input, explainerPackage());
  const result = run(['render', input, '--out-dir', out, '--basename', 'current-loop-visual']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(fs.existsSync(report.html));
  assert.ok(fs.existsSync(report.source));
  const html = fs.readFileSync(report.html, 'utf8');
  assert.match(html, /data-example/);
  assert.match(html, /data-rel/);
  assert.match(html, /输入中的边界一/);
  const verify = run(['verify', report.html, report.source]);
  assert.equal(verify.status, 0, verify.stderr);
});

test('Archify 3.2.0 探测通过，缺失目录可退回', () => {
  const available = run(['probe-archify']);
  assert.equal(available.status, 0, available.stderr);
  assert.equal(JSON.parse(available.stdout).version, '3.2.0');
  const missing = run(['probe-archify', '--archify-dir', path.join(os.tmpdir(), 'archify-not-installed')]);
  assert.notEqual(missing.status, 0);
});

test('空间关系生成简化三维并保留二维退路', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-space-'));
  const input = path.join(root, 'space.json');
  const out = path.join(root, 'topic');
  writeJson(input, {
    topic: '部件空间关系', purpose: '查看输入中已有的方向和位置',
    concepts: [], examples: [], relations: [], steps: [], sources: [], assets: [],
    spatial: {
      items: [
        { id: 'a', label: '部件 A', position: { x: 0, y: 0, z: 0 } },
        { id: 'b', label: '部件 B', position: { x: 2, y: 1, z: 1 } }
      ],
      relations: [{ from: 'a', to: 'b', meaning: '从 A 指向 B' }]
    },
    visualization_request: { preferred_mode: '3d', interaction: 'rotate', allow_3d: true }
  });
  const result = run(['render', input, '--out-dir', out, '--basename', 'space-visual']);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(JSON.parse(result.stdout).html, 'utf8');
  assert.match(html, /id="space-canvas"/);
  assert.match(html, /btn\('view-2d'/);
  assert.match(html, /不代表真实尺寸/);
});

test('缺少例子边界时拒绝生成', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-missing-'));
  const input = path.join(root, 'missing.json');
  const pkg = explainerPackage();
  delete pkg.examples[0].boundary;
  writeJson(input, pkg);
  const result = run(['render', input, '--out-dir', path.join(root, 'out'), '--basename', 'missing-visual']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /boundary/);
  assert.equal(fs.existsSync(path.join(root, 'out')), false);
});

test('更新已知文件前创建历史备份', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-history-'));
  const input = path.join(root, 'content.json');
  const out = path.join(root, 'topic');
  writeJson(input, explainerPackage());
  const first = run(['render', input, '--out-dir', out, '--basename', 'loop-visual']);
  assert.equal(first.status, 0, first.stderr);
  const pkg = explainerPackage();
  pkg.purpose = '更新后的已有目的';
  writeJson(input, pkg);
  const second = run(['render', input, '--out-dir', out, '--basename', 'loop-visual']);
  assert.equal(second.status, 0, second.stderr);
  const report = JSON.parse(second.stdout);
  assert.ok(report.backups.some((item) => item.endsWith('.html')));
  assert.ok(report.backups.some((item) => item.endsWith('.json')));
  assert.ok(fs.existsSync(path.join(out, 'history')));
});

test('来源不明的已有文件不会被覆盖', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-owned-'));
  const input = path.join(root, 'content.json');
  const out = path.join(root, 'topic');
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'loop-visual.html'), '<html>hand edited</html>', 'utf8');
  writeJson(input, explainerPackage());
  const result = run(['render', input, '--out-dir', out, '--basename', 'loop-visual']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /来源不明/);
  assert.equal(fs.readFileSync(path.join(out, 'loop-visual.html'), 'utf8'), '<html>hand edited</html>');
});

test('不存在的输入路径不会创建错误目录', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-path-'));
  const out = path.join(root, 'should-not-exist');
  const result = run(['render', path.join(root, 'missing.json'), '--out-dir', out, '--basename', 'bad']);
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(out), false);
});
