interface ExpectedWrite {
  content: string;
  expiresAt: number;
}

const expectedWrites = new Map<string, ExpectedWrite[]>();

export function expectFileWrite(path: string, content: string): void {
  const now = Date.now();
  const current = (expectedWrites.get(path) ?? []).filter((entry) => entry.expiresAt > now);
  current.push({ content, expiresAt: now + 5_000 });
  expectedWrites.set(path, current);
}

export function consumeExpectedFileWrite(path: string, content: string): boolean {
  const now = Date.now();
  const current = (expectedWrites.get(path) ?? []).filter((entry) => entry.expiresAt > now);
  const match = current.findIndex((entry) => entry.content === content);
  if (match < 0) {
    if (current.length) expectedWrites.set(path, current);
    else expectedWrites.delete(path);
    return false;
  }
  current.splice(match, 1);
  if (current.length) expectedWrites.set(path, current);
  else expectedWrites.delete(path);
  return true;
}
