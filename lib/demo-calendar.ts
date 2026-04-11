export type BusySlot = {
  title: string;
  start: Date;
  end: Date;
};

type DemoEventSpec = {
  title: string;
  weekday: number; // 0 = Sunday, 6 = Saturday (matches Date.getDay())
  startHour: number;
  startMin: number;
  durationMin: number;
};

const DEMO_SPECS: DemoEventSpec[] = [
  {
    title: 'CSCI 5801 Software Engineering I',
    weekday: 2, // Tue
    startHour: 18,
    startMin: 0,
    durationMin: 75,
  },
  {
    title: 'Gym',
    weekday: 4, // Thu
    startHour: 17,
    startMin: 0,
    durationMin: 60,
  },
  {
    title: 'Dinner with roommates',
    weekday: 5, // Fri
    startHour: 19,
    startMin: 0,
    durationMin: 60,
  },
];

function nextOrTodayOccurrence(from: Date, targetDay: number): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const currentDay = d.getDay();
  const diff = (targetDay - currentDay + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function computeDemoCalendar(now: Date = new Date()): BusySlot[] {
  return DEMO_SPECS.map((spec) => {
    const day = nextOrTodayOccurrence(now, spec.weekday);
    day.setHours(spec.startHour, spec.startMin, 0, 0);
    const end = new Date(day);
    end.setMinutes(end.getMinutes() + spec.durationMin);
    return { title: spec.title, start: day, end };
  });
}

export const DEMO_CALENDAR: BusySlot[] = computeDemoCalendar();
