export type GridEvent = {
  id: number;
  title: string;
  url: string;
  date_iso: string;
};

export type GridCell = {
  date: Date;
  inMonth: boolean;
  events: GridEvent[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfMonthSunday(monthStart: Date): Date {
  const firstOfMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1),
  );
  const dayOfWeek = firstOfMonth.getUTCDay(); // 0 = Sunday
  return new Date(firstOfMonth.getTime() - dayOfWeek * MS_PER_DAY);
}

function sameUTCDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function buildMonthGrid(monthStart: Date, events: GridEvent[]): GridCell[] {
  const gridStart = startOfMonthSunday(monthStart);
  const targetMonth = monthStart.getUTCMonth();
  const cells: GridCell[] = [];

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart.getTime() + i * MS_PER_DAY);
    cells.push({
      date: cellDate,
      inMonth: cellDate.getUTCMonth() === targetMonth,
      events: [],
    });
  }

  for (const event of events) {
    const d = new Date(event.date_iso);
    if (Number.isNaN(d.getTime())) continue;
    const cell = cells.find((c) => sameUTCDay(c.date, d));
    if (cell) cell.events.push(event);
  }

  return cells;
}
