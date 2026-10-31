import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skillRoot = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, skillRoot), "utf8");
}

test("用户确认完整目的后直接写入，不重复请求授权", async () => {
  const skill = await read("SKILL.md");
  const rules = await read("why/rules.md");
  const openai = await read("agents/openai.yaml");

  assert.match(skill, /确认同时表示接受当前工作目的并授权写入/);
  assert.match(skill, /不得再追加一次“是否写入文件”的确认/);
  assert.match(rules, /立即创建或更新正式记录，不重复请求写入授权/);
  assert.match(openai, /我一旦确认当前工作目的，就立即写入/);
});

test("保留不写入例外、路径门禁和写后验证", async () => {
  const skill = await read("SKILL.md");
  const rules = await read("why/rules.md");

  assert.match(skill, /只确认目的/);
  assert.match(skill, /用户尚未明确指定输出目录/);
  assert.match(skill, /禁止静默覆盖人工内容/);
  assert.match(skill, /写入后重新读取两份文件/);

  assert.match(rules, /只确认目的、先不写文件或仅保留聊天草稿/);
  assert.match(rules, /用户尚未明确指定输出目录/);
  assert.match(rules, /合并已有人工内容和版本历史/);
  assert.match(rules, /写入后重新读取并检查必要字段/);
});

test("输出地址必须由用户指定且不得位于插件内", async () => {
  const skill = await read("SKILL.md");
  const rules = await read("why/rules.md");
  const openai = await read("agents/openai.yaml");

  assert.match(skill, /用户明确指定一个插件目录之外的绝对输出目录/);
  assert.match(skill, /不得根据当前工作目录、工作区根目录、仓库位置或 Skill 安装位置自行推断/);
  assert.match(skill, /不得把任何具体用户内容写回插件源码、安装目录或缓存目录/);

  assert.match(rules, /必须由用户明确指定插件目录之外的绝对输出目录/);
  assert.match(rules, /用户未指定输出目录时，只询问输出地址/);
  assert.match(openai, /必须让我明确指定插件之外的绝对输出目录/);
});
