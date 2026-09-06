/**
 * Blog content — shared by the blog listing, article pages and the
 * homepage insights section. Replace/extend with CMS data when the
 * backend blog endpoints ship.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  authorRole: string;
  date: string; // ISO
  readTime: string;
  image: string;
  featured?: boolean;
  /** Article body: h = heading, p = paragraph, list = bullet list */
  body: { h?: string; p?: string; list?: string[] }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'launch-your-tech-career-2026',
    title: 'How to Launch Your Tech Career in 2026: A Complete Guide',
    excerpt:
      'Everything you need to know about breaking into tech — from choosing the right specialization to building a portfolio that gets you hired.',
    category: 'Career',
    author: 'VaceUp Admissions Team',
    authorRole: 'Career Support',
    date: '2026-08-20',
    readTime: '8 min read',
    image: '/blog/tech-career.jpg',
    featured: true,
    body: [
      {
        p: 'Tech remains the fastest-growing career path in Nigeria and across Africa — and the barrier to entry is lower than most people think. But "lower" is not "zero". Here is the exact path our successful students follow, distilled from hundreds of graduate outcomes.',
      },
      { h: 'Step 1: Choose one specialization and commit' },
      {
        p: 'The biggest mistake beginners make is sampling everything. Virtual Assistant, Data Analysis, UI/UX Design, Graphic Design and Web Development each lead to real, hireable careers — but only if you go deep enough to build proof of skill. Pick based on what you enjoy doing for hours: organizing and helping people (VA), finding patterns in numbers (data), visual problem-solving (design), or building things that work (web).',
      },
      { h: 'Step 2: Learn in public, with structure' },
      {
        p: 'Self-teaching fails for most people not because the material is hard but because there is no structure and no accountability. A cohort with live classes, deadlines and a tutor reviewing your work changes the equation. That is exactly why our students finish: 6–12 focused weeks with real deadlines beats two years of abandoned tutorials.',
      },
      { h: 'Step 3: Build proof, not just certificates' },
      {
        p: 'Employers and clients hire based on what they can see. By the end of your program you should have 2–3 portfolio pieces: a dashboard, a design case study, a deployed website, or a documented client workflow. Every VaceUp course ends with a capstone designed to be portfolio-ready.',
      },
      { h: 'Step 4: Position yourself' },
      {
        list: [
          'A clean LinkedIn headline that says what you do, not "aspiring" anything.',
          'A simple portfolio page (even a Notion page works to start).',
          'Three specific services you offer, with prices — especially for VA, design and data freelancing.',
          'Applications in volume: remote work is a numbers game early on.',
        ],
      },
      {
        p: 'Ready to start? Explore our courses, pick your track, and enroll in the next cohort. Six weeks from now you could have proof of skill instead of another saved playlist.',
      },
    ],
  },
  {
    slug: 'rise-of-ai-in-african-tech',
    title: 'The Rise of AI in African Tech: Opportunities and Challenges',
    excerpt:
      'How artificial intelligence is transforming the African tech ecosystem — and what it means for developers, designers and entrepreneurs.',
    category: 'Technology',
    author: 'VaceUp Faculty',
    authorRole: 'Technology',
    date: '2026-07-28',
    readTime: '6 min read',
    image: '/blog/ai-africa.jpg',
    body: [
      {
        p: 'AI is not coming to African tech — it is already here. Nigerian fintechs use it for fraud detection, logistics companies for route optimization, and solo freelancers use it to deliver work that used to take teams. The question is no longer whether AI matters, but who knows how to use it well.',
      },
      { h: 'The opportunity: leverage, not replacement' },
      {
        p: 'Every skill we teach gets amplified by AI. Data analysts use AI assistants to draft SQL and clean datasets faster. Designers generate first-draft concepts and iterate with better taste. Virtual assistants manage more clients with AI-supported research and drafting. The professionals at risk are not the ones AI replaces — they are the ones their competitors with AI replace.',
      },
      { h: 'The challenge: infrastructure and skills' },
      {
        p: 'Power and bandwidth remain real constraints, which is exactly why our platform is built to tolerate unstable networks and why our curriculum teaches AI as a tool inside your craft — not as a replacement for fundamentals. When the network drops, fundamentals are what let you keep working.',
      },
      { h: 'What we teach about AI' },
      {
        list: [
          'Practical AI tools inside every course — prompting, reviewing, and correcting AI output.',
          'Data courses cover the machine-learning concepts behind the tools.',
          'Ethics: verifying facts, protecting client data, and transparency about AI use.',
        ],
      },
      {
        p: 'The African builders who master AI-augmented skills today will run the teams of tomorrow. Start learning one.',
      },
    ],
  },
  {
    slug: 'remote-work-best-practices',
    title: 'Remote Work Best Practices for African Professionals',
    excerpt:
      'Timezone management, communication, and reliability — how to succeed in remote roles while working from Nigeria and across Africa.',
    category: 'Remote Work',
    author: 'VaceUp Career Support',
    authorRole: 'Career Support',
    date: '2026-07-10',
    readTime: '7 min read',
    image: '/blog/remote-work.jpg',
    body: [
      {
        p: 'Remote work is the single biggest opportunity shift for African professionals in a generation — but it punishes poor communication and unreliability faster than any office ever could. Here is what separates the professionals who keep clients for years from those who churn through gigs.',
      },
      { h: 'Master asynchronous communication' },
      {
        p: 'Your clients may be 5–8 hours behind. Write updates they can read without a meeting: what you did, what you need, what happens next. A short end-of-day message is worth more than perfect English in a midnight call.',
      },
      { h: 'Make reliability your brand' },
      {
        list: [
          'Deadlines: deliver 24 hours before you promised. Every time.',
          'Power and internet: have a backup — power bank, inverter, second data SIM. Clients do not accept "NEPA took light" after month one.',
          'Over-communicate problems early. A delay reported on Monday is professionalism; the same delay reported on Friday is a firing.',
        ],
      },
      { h: 'Set up like a professional' },
      {
        p: 'A quiet corner, a headset, a clean virtual background, and a professional email signature cost almost nothing and change how clients price you. So does a simple contract — even a one-page agreement — for every engagement.',
      },
      {
        p: 'Our Virtual Assistant program teaches all of this alongside the hard skills, because tools get you hired but professionalism keeps you paid.',
      },
    ],
  },
  {
    slug: 'data-skills-non-tech-professionals',
    title: 'Why Data Skills Are No Longer Optional — Even Outside Tech',
    excerpt:
      'Teachers, shop owners, nurses, civil servants: practical data skills change how every profession makes decisions. Here is where to start.',
    category: 'Data',
    author: 'VaceUp Faculty',
    authorRole: 'Data',
    date: '2026-06-18',
    readTime: '5 min read',
    image: '/blog/data-skills.jpg',
    body: [
      {
        p: 'Ask any business owner in Lagos how the business is doing and you will hear "God is faithful" — which is true, and also not a dashboard. The gap between running a business on vibes and running it on numbers is exactly the gap basic data skills close.',
      },
      { h: 'The 20% of data skills that deliver 80% of value' },
      {
        list: [
          'Clean, organized records: sales, expenses, inventory — in one place, consistently updated.',
          'Pivot tables: answer questions like "which product actually makes money?" in minutes.',
          'One chart that matters: trend of weekly revenue, not fourteen decorative graphs.',
          'A weekly review habit: 30 minutes with your numbers, every week.',
        ],
      },
      { h: 'From spreadsheets to salaries' },
      {
        p: 'Our Data Analysis students start with exactly these fundamentals in Excel before moving to SQL and Python. Many discover that the spreadsheet skills alone transform their current job — the SQL and Python then open new career doors entirely.',
      },
      {
        p: 'You do not need to become a data scientist. You need to stop making decisions blind. That starts with one Excel class.',
      },
    ],
  },
  {
    slug: 'ui-ux-portfolio-that-gets-hired',
    title: 'The UI/UX Portfolio That Actually Gets You Hired',
    excerpt:
      'Recruiters spend 90 seconds on a portfolio. Here is what our tutors look for when reviewing student case studies — and what gets ignored.',
    category: 'Design',
    author: 'VaceUp Design Faculty',
    authorRole: 'Design',
    date: '2026-05-30',
    readTime: '6 min read',
    image: '/blog/design-career.jpg',
    body: [
      {
        p: 'Every week our design tutors review student portfolios, and the pattern is always the same: beautiful screens, no story. Screens without decisions tell the recruiter nothing about how you think — and thinking is what they are hiring.',
      },
      { h: 'The case study formula that works' },
      {
        list: [
          'The problem: one paragraph, specific. "Small restaurants in Lagos lose orders during rush hours because phone ordering fails" — not "I redesigned a food app".',
          'Your process: research snapshots, key insights, and the messy middle — including what you got wrong first.',
          'Your decisions: show 2–3 alternatives you considered and why you chose what you chose.',
          'The outcome: metrics if you have them, honest reflection if you do not.',
        ],
      },
      { h: 'Three strong projects beat ten weak ones' },
      {
        p: 'Depth beats breadth. Two end-to-end case studies plus one visual exploration will out-perform a grid of thirty dribbble-style shots. Our UI/UX capstone exists precisely so you graduate with one deep, honest case study.',
      },
      {
        p: 'Want your portfolio reviewed by working designers? That is built into the program — every student gets line-by-line critique before they graduate.',
      },
    ],
  },
  {
    slug: 'freelancing-versus-employment',
    title: 'Freelancing vs Employment: What New Tech Graduates Should Choose First',
    excerpt:
      'Both paths work. Both have traps. Here is an honest framework for choosing your first income path after upskilling — or combining them.',
    category: 'Career',
    author: 'VaceUp Career Support',
    authorRole: 'Career Support',
    date: '2026-05-12',
    readTime: '6 min read',
    image: '/blog/freelancing.jpg',
    body: [
      {
        p: 'The most common question in our final-week classes: "Should I get a job or start freelancing?" The honest answer depends on your runway, temperament and goals — but the framework below has helped hundreds of our graduates decide well.',
      },
      { h: 'Choose employment first if…' },
      {
        list: [
          'You learn fastest around stronger people — a team is a paid education.',
          'You need structure while you build confidence and speed.',
          'You can find a role where code, dashboards or designs ship to real users.',
        ],
      },
      { h: 'Choose freelancing first if…' },
      {
        list: [
          'You have 3+ months of living costs saved and can survive irregular income at the start.',
          'You already have a network that needs your skill — churches, schools, businesses, family businesses.',
          'Your goal is location freedom and you are disciplined with deadlines.',
        ],
      },
      { h: 'The hybrid path most people miss' },
      {
        p: 'Freelance two clients while job-hunting. It pads your income, builds your portfolio, and interviews go differently when you say "in my client work last month…" instead of "in my tutorial last month…". Several of our alumni converted freelance clients into full-time offers.',
      },
      {
        p: 'Whichever path you choose, the first step is the same: real, verifiable skills. Start there.',
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
