import { limits, nextReset, type Mode } from '../shared/contracts';
type Ledger = {
  counts: Partial<Record<Mode, number>>;
  visitors: Record<string, Partial<Record<Mode, number>>>;
  requests: string[];
};
export class QuotaLedger {
  constructor(private state: DurableObjectState) {}
  async fetch(request: Request) {
    const { visitor, mode, requestId } = (await request.json()) as {
      visitor: string;
      mode: Mode;
      requestId: string;
    };
    if (!limits[mode] || !visitor || !requestId)
      return Response.json({ error: 'Invalid quota request' }, { status: 400 });
    const date = new Date().toISOString().slice(0, 10);
    const key = `day:${date}`;
    return this.state.storage.transaction(async (tx) => {
      const ledger = (await tx.get<Ledger>(key)) || { counts: {}, visitors: {}, requests: [] };
      if (ledger.requests.includes(requestId))
        return Response.json(
          { code: 'DUPLICATE', message: 'This request already started. Please start a new one.' },
          { status: 409 },
        );
      const user = ledger.visitors[visitor] || {};
      if (
        (ledger.counts[mode] || 0) >= limits[mode].global ||
        (user[mode] || 0) >= limits[mode].visitor
      )
        return Response.json(
          {
            code: 'QUOTA',
            message: 'Today’s studio allowance is used up. Come back after the reset.',
            resetAt: nextReset(),
          },
          { status: 429 },
        );
      ledger.counts[mode] = (ledger.counts[mode] || 0) + 1;
      user[mode] = (user[mode] || 0) + 1;
      ledger.visitors[visitor] = user;
      ledger.requests.push(requestId);
      await tx.put(key, ledger);
      if (!(await tx.getAlarm())) await tx.setAlarm(Date.parse(nextReset()) + 60000);
      return Response.json({ remaining: limits[mode].visitor - user[mode]! });
    });
  }
  async alarm() {
    const all = await this.state.storage.list();
    const today = new Date().toISOString().slice(0, 10);
    for (const key of all.keys()) if (key !== `day:${today}`) await this.state.storage.delete(key);
  }
}
