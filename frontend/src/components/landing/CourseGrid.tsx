'use client';

import React from 'react';

export interface CourseModule {
  title: string;
  topics?: string[];
}

export interface Course {
  id: string;
  title: string;
  category: 'professional' | 'kids';
  tagline: string;
  level: string;
  duration: string;
  price: string;
  numericPrice: number;
  description: string;
  image: string;
  learnings: string[];
  modules: CourseModule[];
  benefits: string[];
}

export const COURSES: Course[] = [
  // --- PROFESSIONAL COURSES ---
  {
    id: 'virtual-assistant',
    title: 'Virtual Assistance',
    category: 'professional',
    tagline: 'Get paid to support businesses remotely from anywhere.',
    level: 'Beginner → Advanced',
    duration: '2 Months',
    price: '₦50,000',
    numericPrice: 50000,
    description: 'Equips learners with practical administrative, communication, digital productivity, and client-support skills required to operate as a professional Virtual Assistant.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'Administrative support & email management',
      'Calendar management & meeting coordination',
      'Digital productivity tools & cloud workspaces',
      'Internet research & information management',
      'Customer support & client onboarding',
      'Project management & professional VA portfolio creation',
    ],
    modules: [
      { title: 'Module 1 — Introduction to Virtual Assistance', topics: ['What is Virtual Assistance?', 'Types of VAs & Services', 'Remote work fundamentals', 'Skills required for VA success'] },
      { title: 'Module 2 — Professional Communication', topics: ['Professional email communication', 'Business writing & etiquette', 'Handling difficult conversations', 'Meeting communication'] },
      { title: 'Module 3 — Administrative Support', topics: ['Document preparation & file organization', 'Data entry & scheduling', 'Calendar management', 'Travel planning & workflows'] },
      { title: 'Module 4 — Digital Productivity Tools', topics: ['Cloud storage & collaboration', 'Spreadsheets & scheduling tools', 'Productivity systems', 'Practical: Digital workspace setup'] },
      { title: 'Module 5 — Research & Information Management', topics: ['Internet search techniques', 'Information verification', 'Data collection & documentation', 'Research ethics'] },
      { title: 'Module 6 — Customer & Client Support', topics: ['Client onboarding', 'Ticket & task management', 'Follow-ups & client satisfaction', 'Handling complaints'] },
      { title: 'Module 7 — Project & Task Management', topics: ['Task prioritization & deadlines', 'Workflow tracking', 'Delegation & reporting', 'Productivity systems'] },
      { title: 'Module 8 — Becoming a Professional VA', topics: ['VA portfolio & resume creation', 'Personal branding & proposals', 'Finding opportunities & boundaries', 'Pricing basics'] },
    ],
    benefits: ['Weekly live labs', 'Real workspace setups', 'Portfolio dashboard', 'Career coaching', 'Certificate of Completion'],
  },
  {
    id: 'data-analysis',
    title: 'Data Analysis',
    category: 'professional',
    tagline: 'Turn raw data into business decisions companies pay for.',
    level: 'Beginner → Advanced',
    duration: '3 Months',
    price: '₦70,000',
    numericPrice: 70000,
    description: 'Master the complete pipeline of transforming raw data into meaningful insights using Excel, SQL, Data Visualization, and Business Intelligence dashboards.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'Data concepts & analytical thinking process',
      'Spreadsheet analysis, formulas, and Pivot Tables',
      'Dataset cleaning, validation, and missing data handling',
      'Relational database querying with SQL',
      'Data visualization principles and storytelling',
      'BI interactive dashboard development & portfolio',
    ],
    modules: [
      { title: 'Module 1 — Introduction to Data Analysis', topics: ['Data types & analysis process', 'Data analyst responsibilities', 'Analytical thinking & decision-making'] },
      { title: 'Module 2 — Excel / Spreadsheet Analysis', topics: ['Spreadsheet formulas & functions', 'Sorting, filtering & conditional formatting', 'Data cleaning & Pivot tables'] },
      { title: 'Module 3 — Data Cleaning & Preparation', topics: ['Handling missing data & duplicates', 'Inconsistent data & formatting', 'Data validation for analysis'] },
      { title: 'Module 4 — SQL Fundamentals', topics: ['Databases & tables', 'SELECT, WHERE, GROUP BY, ORDER BY', 'JOINs & Aggregations', 'Practical database analysis'] },
      { title: 'Module 5 — Data Visualization', topics: ['Principles of visualization', 'Choosing charts & dashboards', 'Data storytelling & presenting insights'] },
      { title: 'Module 6 — BI / Dashboard Development', topics: ['Connecting datasets', 'Creating interactive filters', 'Presenting business insights'] },
      { title: 'Module 7 — Analytical Thinking', topics: ['Asking analytical questions', 'Identifying patterns, trends, relationships', 'Business problem solving'] },
      { title: 'Module 8 — Data Portfolio', topics: ['Project documentation', 'Portfolio presentation & case studies', 'Preparing for data roles'] },
    ],
    benefits: ['Weekly live labs', 'Real industry datasets', 'Portfolio dashboards', 'Career coaching', 'Certificate of Completion'],
  },
  {
    id: 'ui-ux-design',
    title: 'UI/UX Design',
    category: 'professional',
    tagline: 'Design user-first digital products for web and mobile.',
    level: 'Beginner → Advanced',
    duration: '3 Months',
    price: '₦70,000',
    numericPrice: 70000,
    description: 'Learn user research, wireframing, information architecture, interface design, interactive prototyping, and usability testing.',
    image: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'Design thinking & UX research methodologies',
      'User personas and user journey mapping',
      'Information architecture & sitemaps',
      'Wireframing & mobile-first UI design',
      'Design systems, components & interactive prototypes',
      'Usability testing and developer handoffs',
    ],
    modules: [
      { title: 'Module 1 — Introduction to UI/UX', topics: ['UI vs UX', 'Design thinking framework', 'User-centred design process'] },
      { title: 'Module 2 — UX Research', topics: ['Interviews, surveys & competitor research', 'Defining user problems', 'Research documentation'] },
      { title: 'Module 3 — User Personas & User Journeys', topics: ['Personas & user goals', 'Pain points & journey mapping', 'User flows'] },
      { title: 'Module 4 — Information Architecture', topics: ['Content structure & navigation', 'Sitemap design', 'Information hierarchy'] },
      { title: 'Module 5 — Wireframing', topics: ['Low-fidelity vs high-fidelity wireframes', 'Layouts & components', 'Mobile-first thinking'] },
      { title: 'Module 6 — UI Design Fundamentals', topics: ['Typography, colour, spacing', 'Visual hierarchy & grid systems', 'Buttons & forms'] },
      { title: 'Module 7 — Design Systems & Prototyping', topics: ['Reusable design components', 'Interactive prototyping', 'Developer handoff standards'] },
      { title: 'Module 8 — Usability Testing', topics: ['Testing designs with users', 'Feedback synthesis & iteration', 'Improving product usability'] },
    ],
    benefits: ['Figma mastery', 'Live design critique', 'Case study portfolio', 'Career guidance', 'Certificate of Completion'],
  },
  {
    id: 'graphic-design',
    title: 'Graphic Design',
    category: 'professional',
    tagline: 'Create world-class brand identities and visual assets.',
    level: 'Beginner → Advanced',
    duration: '2 Months',
    price: '₦60,000',
    numericPrice: 60000,
    description: 'Equips learners with creative and technical skills required to produce professional visual communications for brands, businesses, and social media.',
    image: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'Core design principles & composition',
      'Color theory and typography systems',
      'Branding and visual identity creation',
      'Social media graphics & marketing designs',
      'Professional design workflow & portfolio build',
    ],
    modules: [
      { title: 'Module 1 — Fundamentals of Graphic Design' },
      { title: 'Module 2 — Colour Theory' },
      { title: 'Module 3 — Typography' },
      { title: 'Module 4 — Layout & Composition' },
      { title: 'Module 5 — Branding & Visual Identity' },
      { title: 'Module 6 — Social Media Design' },
      { title: 'Module 7 — Marketing & Promotional Design' },
      { title: 'Module 7 — Professional Design Workflow' },
    ],
    benefits: ['Live design reviews', 'Real brand briefs', 'Portfolio setup', 'Freelance guidance', 'Certificate of Completion'],
  },
  {
    id: 'web-development',
    title: 'Web Development',
    category: 'professional',
    tagline: 'Build, deploy, and host modern responsive web applications.',
    level: 'Beginner → Advanced',
    duration: '3 Months',
    price: '₦80,000',
    numericPrice: 80000,
    description: 'Master full-stack fundamentals including HTML, CSS, JavaScript, Git, frontend user interfaces, backend database architectures, and cloud deployment.',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'Semantic HTML5 & modern CSS3 layouts',
      'Responsive web design principles',
      'JavaScript ES6+ programming & DOM interaction',
      'Git version control & GitHub collaboration',
      'Frontend development & backend/database basics',
      'REST APIs, deployment, and live hosting',
    ],
    modules: [
      { title: 'Module 1 — Web Development Fundamentals' },
      { title: 'Module 2 — HTML' },
      { title: 'Module 3 — CSS' },
      { title: 'Module 4 — Responsive Web Design' },
      { title: 'Module 5 — JavaScript' },
      { title: 'Module 6 — Git & GitHub' },
      { title: 'Module 7 — Frontend Development' },
      { title: 'Module 8 — Backend & Database Fundamentals' },
      { title: 'Module 9 — APIs' },
      { title: 'Module 10 — Deployment & Hosting' },
    ],
    benefits: ['GitHub portfolio build', 'Live coding sessions', 'Capstone web app', 'Career support', 'Certificate of Completion'],
  },
  {
    id: 'artificial-intelligence',
    title: 'Artificial Intelligence',
    category: 'professional',
    tagline: 'Leverage AI tools responsibly to boost productivity and workflow.',
    level: 'Beginner → Advanced',
    duration: '2 Months',
    price: '₦65,000',
    numericPrice: 65000,
    description: 'Focuses on responsible and practical AI usage in business, research, and daily workflows rather than simply memorizing software options.',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'AI concepts, Machine Learning & Generative AI',
      'Prompt engineering frameworks & contextual instructions',
      'AI for productivity, writing, research, and presentations',
      'AI business automation & customer support integrations',
      'AI-assisted data analysis & interpretation',
      'AI ethics, privacy, security, and human oversight',
    ],
    modules: [
      { title: 'Module 1 — Introduction to Artificial Intelligence', topics: ['What is AI & History', 'AI vs Automation', 'Machine Learning & Generative AI'] },
      { title: 'Module 2 — AI Tools & Applications', topics: ['AI Assistants', 'Productivity, research, content & business tools'] },
      { title: 'Module 3 — Prompt Engineering', topics: ['Prompt structure & context', 'Instructions & iteration', 'Evaluating AI responses'] },
      { title: 'Module 4 — AI for Productivity', topics: ['Research, writing & planning', 'Data assistance & presentations', 'Workflow automation'] },
      { title: 'Module 5 — AI for Business', topics: ['Customer support & marketing', 'Research & process optimization', 'Decision support'] },
      { title: 'Module 6 — AI & Data', topics: ['Data and AI interactions', 'AI-assisted analysis', 'Limitations & human checks'] },
      { title: 'Module 7 — AI Ethics', topics: ['Bias, privacy & security', 'Misinformation & responsible use', 'Human oversight'] },
      { title: 'Module 8 — AI Projects', topics: ['Designing an AI-powered workflow to solve a practical problem'] },
    ],
    benefits: ['Practical workflows', 'Prompt templates', 'Ethics framework', 'Capstone project', 'Certificate of Completion'],
  },

  // --- KIDS TECH ACADEMY COURSES (Hidden until showKidsCourses = true) ---
  {
    id: 'kids-graphic-design',
    title: 'Graphic Design for Kids',
    category: 'kids',
    tagline: 'Inspiring visual creativity & digital art for young minds.',
    level: 'Beginner (Ages 7-15)',
    duration: '6 Weeks',
    price: '₦40,000',
    numericPrice: 40000,
    description: 'Children explore shapes, colors, layout, and typography in an engaging, project-based environment to create digital artwork, posters, and simple branding.',
    image: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'Digital shapes, colors, and typography',
      'Digital illustration and drawing basics',
      'Creating posters and social graphics',
      'Simple brand creation for creative projects',
    ],
    modules: [
      { title: 'Module 1 — Introduction to Digital Design' },
      { title: 'Module 2 — Colours & Shapes' },
      { title: 'Module 3 — Typography' },
      { title: 'Module 4 — Layout & Composition' },
      { title: 'Module 5 — Digital Illustration' },
      { title: 'Module 6 — Poster Design' },
      { title: 'Module 7 — Simple Branding' },
      { title: 'Module 8 — Creative Portfolio' },
    ],
    benefits: ['Fun project labs', 'Kid-friendly tools', 'Creative exhibition', 'Kids Tech Certificate'],
  },
  {
    id: 'kids-ui-ux',
    title: 'UI/UX Design for Kids',
    category: 'kids',
    tagline: 'Helping children design app interfaces and solve user problems.',
    level: 'Beginner (Ages 8-15)',
    duration: '6 Weeks',
    price: '₦40,000',
    numericPrice: 40000,
    description: 'Young learners explore how apps and websites are constructed, sketch screen layouts, create wireframes, and design interactive app prototypes.',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'Understanding app structure and user goals',
      'Idea generation & problem solving',
      'Interface sketching and wireframing',
      'Prototyping interactive app prototypes',
    ],
    modules: [
      { title: 'Module 1 — What Are Apps & Websites?' },
      { title: 'Module 2 — Understanding Users' },
      { title: 'Module 3 — Ideas & Problem Solving' },
      { title: 'Module 4 — Sketching Interfaces' },
      { title: 'Module 5 — Wireframes' },
      { title: 'Module 6 — Colour & Typography' },
      { title: 'Module 7 — Designing App Screens' },
      { title: 'Module 8 — Creating a Prototype' },
    ],
    benefits: ['Interactive app builds', 'Creative problem solving', 'Prototype Showcase', 'Kids Tech Certificate'],
  },
  {
    id: 'kids-web-dev',
    title: 'Web Development for Kids',
    category: 'kids',
    tagline: 'Teaching young creators how to code and build real webpages.',
    level: 'Beginner (Ages 8-15)',
    duration: '8 Weeks',
    price: '₦45,000',
    numericPrice: 45000,
    description: 'Children learn code fundamentals through HTML, CSS, and interactive JavaScript, building their own web pages from scratch.',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'How the internet and websites work',
      'HTML elements, structure, and text styling',
      'CSS styling, colors, and layout building',
      'Interactive JavaScript for dynamic elements',
    ],
    modules: [
      { title: 'Module 1 — Introduction to the Web' },
      { title: 'Module 2 — How Websites Work' },
      { title: 'Module 3 — HTML Fundamentals' },
      { title: 'Module 4 — Creating Webpages' },
      { title: 'Module 5 — CSS Fundamentals' },
      { title: 'Module 6 — Styling Websites' },
      { title: 'Module 7 — Introduction to JavaScript' },
      { title: 'Module 8 — Building an Interactive Website' },
    ],
    benefits: ['Live web project', 'Kid-safe coding environment', 'Personal Website', 'Kids Tech Certificate'],
  },
  {
    id: 'kids-ai',
    title: 'AI for Kids',
    category: 'kids',
    tagline: 'Demystifying AI for kids through safe, responsible, and creative projects.',
    level: 'Beginner (Ages 8-15)',
    duration: '6 Weeks',
    price: '₦45,000',
    numericPrice: 45000,
    description: 'Helps children understand what AI is, how computers learn from data, how to prompt generative AI, and how to use technology safely and ethically.',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800',
    learnings: [
      'What AI is and how it powers games and phones',
      'How computers learn through data and patterns',
      'Prompting AI for creative writing and image creation',
      'AI safety, privacy, misinformation, and ethical use',
    ],
    modules: [
      { title: 'Module 1 — What is AI?', topics: ['AI in phones, games, and education'] },
      { title: 'Module 2 — How Computers Learn', topics: ['Data, patterns, and machine learning'] },
      { title: 'Module 3 — Exploring Generative AI', topics: ['Text, images, and creative ideas'] },
      { title: 'Module 4 — Prompting AI', topics: ['Clear instructions and effective prompts'] },
      { title: 'Module 5 — AI Creativity', topics: ['Stories, artwork, and presentation tools'] },
      { title: 'Module 6 — AI Problem Solving', topics: ['Solving simple everyday problems with AI'] },
      { title: 'Module 7 — AI Safety & Ethics', topics: ['Privacy, misinformation, bias, responsible use'] },
      { title: 'Module 8 — AI Project', topics: ['Age-appropriate AI-assisted capstone project'] },
    ],
    benefits: ['Safe AI lab tools', 'Ethics-first approach', 'Creative capstone', 'Kids Tech Certificate'],
  },
];

interface CourseGridProps {
  onViewCourse: (course: Course) => void;
  // Set this to true when Kids Tech Academy is live
  showKidsCourses?: boolean;
}

export const CourseGrid: React.FC<CourseGridProps> = ({
  onViewCourse,
  showKidsCourses = false,
}) => {
  // Filter courses based on the showKidsCourses toggle
  const visibleCourses = COURSES.filter(
    (course) => showKidsCourses || course.category === 'professional'
  );

  return (
    <section id="courses" className="bg-white py-20 text-navy-950">
      <div className="mx-auto max-w-7xl px-6">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-teal-brand">
              OUR PROGRAMMES
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-navy-950 tracking-tight mt-2">
              Build skills that move your <br className="hidden sm:block" /> career & future forward
            </h2>
            <p className="text-sm text-gray-600 mt-3 max-w-xl">
              Practitioner-led tracks ending with a hands-on portfolio, a recognized certificate, and real opportunity.
            </p>
          </div>

          {/* View All Courses Button */}
          <button className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-xs font-bold text-navy-950 shadow-sm hover:bg-gray-50 hover:shadow transition-all self-start md:self-auto">
            <span>All courses</span>
            <span>→</span>
          </button>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {visibleCourses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col justify-between overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl shadow-gray-100/80 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
            >
              {/* Thumbnail Image */}
              <div className="relative h-48 w-full bg-gradient-to-br from-navy-900 to-navy-900 overflow-hidden">
                <img
                  src={course.image}
                  alt={course.title}
                  className="h-full w-full object-cover opacity-90 transition-transform duration-500 hover:scale-105"
                />
                <span className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[10px] font-bold tracking-wide uppercase text-navy-950 shadow-sm">
                  {course.category === 'kids' ? 'Kids Tech' : 'Professional Track'}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-navy-950">{course.title}</h3>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {course.tagline}
                  </p>

                  <div className="mt-6 space-y-2 text-xs font-medium text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="text-teal-brand">📊</span>
                      <span>{course.level}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-brand">⏱</span>
                      <span>{course.duration}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xl font-black text-navy-950">{course.price}</span>
                  <button
                    onClick={() => onViewCourse(course)}
                    className="rounded-xl bg-gold-brand px-5 py-2.5 text-xs font-bold text-navy-950 shadow-md hover:bg-gold-hover transition-all"
                  >
                    View Course
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default CourseGrid;