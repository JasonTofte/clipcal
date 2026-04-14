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

// Demo feed events — shown in the feed when demo mode is on and the user
// hasn't uploaded any flyers yet. Dates are computed relative to now so
// they always appear upcoming.
import type { Event } from '@/lib/schema';

function daysFromNow(n: number, hour: number, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

export function computeDemoFeedEvents(): Event[] {
  return [
    {
      title: 'Hack the Burg — 24hr Hackathon',
      start: daysFromNow(2, 18, 0),
      end: daysFromNow(3, 18, 0),
      location: 'Coffman Memorial Union',
      description: 'Build something wild in 24 hours. Food, prizes, mentors on-site.',
      category: 'hackathon',
      hasFreeFood: true,
      timezone: 'America/Chicago',
      confidence: 'high',
      venueSetting: 'indoor',
      crowdSize: 'large',
    },
    {
      title: 'Tech Industry Networking Night',
      start: daysFromNow(4, 17, 30),
      end: daysFromNow(4, 20, 0),
      location: 'Carlson School of Management',
      description: 'Meet recruiters from Google, Meta, Target, and local startups.',
      category: 'networking',
      hasFreeFood: true,
      timezone: 'America/Chicago',
      confidence: 'high',
      venueSetting: 'indoor',
      crowdSize: 'medium',
    },
    {
      title: 'Intro to Machine Learning Workshop',
      start: daysFromNow(5, 14, 0),
      end: daysFromNow(5, 16, 0),
      location: 'Keller Hall 3-125',
      description: 'Hands-on intro to scikit-learn and neural nets. Beginner friendly.',
      category: 'workshop',
      hasFreeFood: false,
      timezone: 'America/Chicago',
      confidence: 'high',
      venueSetting: 'indoor',
      crowdSize: 'small',
    },
    {
      title: 'End of Semester Rooftop Social',
      start: daysFromNow(6, 19, 0),
      end: daysFromNow(6, 22, 0),
      location: 'Pioneer Hall Rooftop',
      description: 'Wind down the semester with live music and free snacks.',
      category: 'social',
      hasFreeFood: true,
      timezone: 'America/Chicago',
      confidence: 'high',
      venueSetting: 'outdoor',
      crowdSize: 'medium',
    },
  ];
}
