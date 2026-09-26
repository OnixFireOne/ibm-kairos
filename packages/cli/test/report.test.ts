import { describe, expect, it, vi } from 'vitest';
import { extractJson, parseReply, parseWithRepair, ReplyParseError } from '../src/report/parse.js';
import { bobReplyJsonSchema, DriftReport } from '../src/report/schema.js';

const finding = {
  id: 'KRS-001',
  type: 'STALE_DOC',
  severity: 'medium',
  title: 'README still documents DB_URL',
  code: { file: 'src/config.ts', lines: [2, 2], excerpt: "process.env['DATABASE_URL']" },
  intent: { file: 'README.md', lines: [5, 5], excerpt: 'Set `DB_URL` ...' },
  explanation: 'The env var was renamed but the README was not updated.',
  truth: 'code',
  proposal: { action: 'update_doc', summary: 'Rename DB_URL to DATABASE_URL in the README.' },
  confidence: 0.9,
};
const reply = { findings: [finding], summary: 'One stale doc.' };
const json = JSON.stringify(reply);

describe('extractJson', () => {
  it('reads raw JSON, fenced JSON (last block wins) and JSON wrapped in prose', () => {
    expect(extractJson(json)).toEqual(reply);
    expect(extractJson('```json\n{"a":1}\n```\nthen\n```json\n' + json + '\n```')).toEqual(reply);
    expect(extractJson(`Here is the report:\n${json}\nDone.`)).toEqual(reply);
  });

  it('throws ReplyParseError when there is no JSON', () => {
    expect(() => extractJson('no findings, all good')).toThrow(ReplyParseError);
  });
});

describe('parseReply', () => {
  it('accepts a valid reply and an empty findings list', () => {
    expect(parseReply(json)).toEqual({ ok: true, reply });
    expect(parseReply('{"findings":[],"summary":"clean"}')).toEqual({
      ok: true,
      reply: { findings: [], summary: 'clean' },
    });
  });

  it('normalises a single line number and a missing intent', () => {
    const loose = { ...finding, code: { ...finding.code, lines: 7 }, intent: undefined };
    const res = parseReply(JSON.stringify({ findings: [loose], summary: 's' }));
    expect(res.ok && res.reply.findings[0]!.code.lines).toEqual([7, 7]);
    expect(res.ok && res.reply.findings[0]!.intent).toBeNull();
  });

  it('reports schema problems with their paths', () => {
    const bad = { findings: [{ ...finding, type: 'TYPO', confidence: 2 }], summary: 's' };
    const res = parseReply(JSON.stringify(bad));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/findings\.0\.type[\s\S]*findings\.0\.confidence/);
  });
});

describe('parseWithRepair', () => {
  it('does not call repair when the first reply is valid', async () => {
    const repair = vi.fn();
    await expect(parseWithRepair(json, repair)).resolves.toEqual(reply);
    expect(repair).not.toHaveBeenCalled();
  });

  it('asks once for a corrected reply, passing the problems and the schema', async () => {
    const repair = vi.fn().mockResolvedValue(json);
    await expect(parseWithRepair('{"findings": "oops"}', repair)).resolves.toEqual(reply);
    expect(repair).toHaveBeenCalledOnce();
    const prompt = repair.mock.calls[0]![0] as string;
    expect(prompt).toContain('findings: ');
    expect(prompt).toContain('"UNDOCUMENTED_BEHAVIOR"');
  });

  it('fails with both errors when the repair is still invalid', async () => {
    const repair = vi.fn().mockResolvedValue('still not json');
    await expect(parseWithRepair('nope', repair)).rejects.toThrow(/even after one repair attempt/);
    expect(repair).toHaveBeenCalledOnce();
  });
});

describe('schemas', () => {
  it('exports a JSON Schema listing every finding type and field', () => {
    const schema = JSON.parse(bobReplyJsonSchema());
    const item = schema.properties.findings.items;
    expect(item.properties.type.enum).toEqual([
      'SPEC_VIOLATION',
      'UNDOCUMENTED_BEHAVIOR',
      'STALE_DOC',
      'MISSING_TEST',
      'ADR_CONFLICT',
    ]);
    expect(item.required).toEqual(
      expect.arrayContaining(['id', 'code', 'intent', 'truth', 'confidence']),
    );
  });

  it('validates a stored DriftReport', () => {
    const report = {
      ...reply,
      runId: '20260926-120000',
      base: 'origin/main',
      head: 'abc123',
      createdAt: '2026-09-26T12:00:00.000Z',
      cost: { bobcoins: 0.4 },
    };
    expect(DriftReport.parse(report)).toEqual(report);
    expect(() => DriftReport.parse({ ...report, createdAt: 'yesterday' })).toThrow();
  });
});
