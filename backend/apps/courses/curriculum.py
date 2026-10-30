"""Draft curriculum transcribed from the academy curriculum brief.

Every course is created unpublished. Modules follow one-per-week; lesson
bodies list the source topics so an admin can review and expand them before
publishing. Prices and durations are taken from the brief.
"""

ADULT_CURRICULUM = [
    {
        "slug": "virtual-assistant",
        "aliases": ["Virtual Assistance"],
        "title": "Virtual Assistant",
        "category": "Professional Skills",
        "price": 70000,
        "duration": "8 Weeks",
        "tagline": "Build a professional remote-assistant career with practical administrative and client-support skills.",
        "description": (
            "The Virtual Assistant programme equips learners with the practical "
            "administrative, communication, digital productivity and client-support "
            "skills required to work effectively as a professional Virtual Assistant."
        ),
        "outcomes": [
            "Administrative support", "Email management", "Calendar management",
            "Internet research", "Document management", "Communication",
            "Meeting coordination", "Task management", "Customer support",
            "Digital productivity", "Client management", "Professional remote-work practices",
        ],
        "target_audience": "Aspiring virtual assistants, administrative officers and remote-work professionals.",
        "modules": [
            ("Introduction to Virtual Assistance", [
                "What is Virtual Assistance?", "The role of a Virtual Assistant",
                "Types of Virtual Assistants", "VA services", "Remote work fundamentals",
                "Understanding clients", "Professional expectations",
                "Skills required for VA success",
            ], ""),
            ("Professional Communication", [
                "Professional email communication", "Business writing", "Client communication",
                "Tone and professionalism", "Communication etiquette",
                "Handling difficult conversations", "Meeting communication",
                "Written communication standards",
            ], ""),
            ("Administrative Support", [
                "Document preparation", "File organization", "Data entry", "Scheduling",
                "Calendar management", "Meeting coordination", "Travel planning",
                "Administrative workflows",
            ], ""),
            ("Digital Productivity Tools", [
                "Cloud storage", "Document collaboration", "Spreadsheets", "Task management",
                "Communication tools", "Scheduling tools", "Productivity systems",
                "Digital organization",
            ], "Create a complete digital workspace."),
            ("Research & Information Management", [
                "Internet research", "Search techniques", "Information verification",
                "Data collection", "Research documentation", "Presenting findings",
                "Research ethics",
            ], ""),
            ("Customer & Client Support", [
                "Customer service", "Client onboarding", "Managing client requests",
                "Ticket/task management", "Follow-ups", "Client satisfaction",
                "Handling complaints",
            ], ""),
            ("Project & Task Management", [
                "Task prioritization", "Deadlines", "Workflow management", "Project tracking",
                "Delegation", "Reporting", "Productivity systems",
            ], ""),
            ("Becoming a Professional VA", [
                "Creating a VA portfolio", "CV/resume", "Professional profile",
                "Personal branding", "Finding opportunities", "Client proposals",
                "Interview preparation", "Pricing basics", "Professional boundaries",
            ], ""),
        ],
    },
    {
        "slug": "data-analysis",
        "aliases": [],
        "title": "Data Analysis",
        "category": "Data & Analytics",
        "price": 70000,
        "duration": "8 Weeks",
        "tagline": "Turn raw data into decisions with spreadsheets, SQL, dashboards and clear reporting.",
        "description": (
            "The Data Analysis programme introduces learners to the process of "
            "transforming raw data into meaningful information that can support "
            "decision-making."
        ),
        "outcomes": [
            "Data concepts", "Data cleaning", "Spreadsheet analysis", "SQL",
            "Data visualization", "Analytical thinking", "Reporting",
            "Dashboard development", "Data storytelling",
        ],
        "target_audience": "Aspiring data analysts, business analysts and reporting officers.",
        "modules": [
            ("Introduction to Data Analysis", [
                "What is data?", "Types of data", "Data analysis process",
                "Data analyst responsibilities", "Analytical thinking",
                "Data-driven decision-making",
            ], ""),
            ("Excel / Spreadsheet Analysis", [
                "Spreadsheet fundamentals", "Formulas", "Functions", "Sorting and filtering",
                "Conditional formatting", "Data cleaning", "Pivot tables", "Charts",
            ], ""),
            ("Data Cleaning & Preparation", [
                "Missing data", "Duplicates", "Inconsistent data", "Data formatting",
                "Data validation", "Preparing datasets for analysis",
            ], ""),
            ("SQL", [
                "Databases", "Tables", "Queries", "SELECT", "WHERE", "GROUP BY",
                "ORDER BY", "JOINs", "Aggregations", "Practical database analysis",
            ], ""),
            ("Data Visualization", [
                "Principles of visualization", "Charts", "Dashboards",
                "Choosing appropriate visualizations", "Data storytelling",
                "Presenting insights",
            ], ""),
            ("BI / Dashboard Development", [
                "Dashboard concepts", "Connecting datasets", "Creating visualizations",
                "Filters", "Interactive dashboards", "Presenting business insights",
            ], ""),
            ("Analytical Thinking", [
                "Asking analytical questions", "Identifying patterns", "Trends",
                "Relationships", "Business problems", "Generating insights",
            ], ""),
            ("Data Portfolio", [
                "Data project documentation", "Portfolio presentation", "Case studies",
                "Presenting insights", "Preparing for data roles",
            ], ""),
        ],
    },
    {
        "slug": "ui-ux-design",
        "aliases": [],
        "title": "UI/UX Design",
        "category": "Design",
        "price": 70000,
        "duration": "8 Weeks",
        "tagline": "Research users, solve real problems and design polished digital interfaces.",
        "description": (
            "The UI/UX Design programme teaches learners how to research users, "
            "identify problems, design digital experiences and create high-quality "
            "interfaces for websites and applications."
        ),
        "outcomes": [
            "UX research", "User personas", "User journeys", "Wireframing",
            "Information architecture", "UI design", "Design systems", "Prototyping",
            "Usability testing", "Responsive design", "Portfolio development",
        ],
        "target_audience": "Aspiring product designers, UI/UX designers and frontend creatives.",
        "modules": [
            ("Introduction to UI/UX", [
                "UI vs UX", "Design thinking", "User-centred design", "Digital products",
                "UX process",
            ], ""),
            ("UX Research", [
                "Understanding users", "Interviews", "Surveys", "Competitor research",
                "User problems", "Research documentation",
            ], ""),
            ("User Personas & User Journeys", [
                "Personas", "User goals", "Pain points", "User journeys", "User flows",
            ], ""),
            ("Information Architecture", [
                "Content structure", "Navigation", "Sitemap", "User flow",
                "Information hierarchy",
            ], ""),
            ("Wireframing", [
                "Low-fidelity wireframes", "High-fidelity wireframes", "Layout",
                "Components", "Mobile-first thinking",
            ], ""),
            ("UI Design", [
                "Typography", "Colour", "Spacing", "Visual hierarchy", "Grids",
                "Components", "Buttons", "Forms",
            ], ""),
            ("Design Systems & Prototyping", [
                "Design systems", "Components", "Reusable elements",
                "Interactive prototypes", "Developer handoff",
            ], ""),
            ("Usability Testing", [
                "Testing designs", "User feedback", "Identifying problems", "Iteration",
                "Improving usability",
            ], ""),
        ],
    },
    {
        "slug": "graphic-design",
        "aliases": [],
        "title": "Graphic Design",
        "category": "Design",
        "price": 70000,
        "duration": "8 Weeks",
        "tagline": "Create professional visual communication for brands, businesses and digital platforms.",
        "description": (
            "The Graphic Design programme equips learners with the creative and "
            "technical skills required to create professional visual communication "
            "for brands, businesses and digital platforms."
        ),
        "outcomes": [
            "Design principles", "Typography", "Colour theory", "Layout", "Branding",
            "Social media design", "Marketing materials", "Digital graphics",
            "Portfolio development",
        ],
        "target_audience": "Aspiring graphic designers, social media creatives and brand assistants.",
        "modules": [
            ("Fundamentals of Graphic Design", [], ""),
            ("Colour Theory", [], ""),
            ("Typography", [], ""),
            ("Layout & Composition", [], ""),
            ("Branding & Visual Identity", [], ""),
            ("Social Media Design", [], ""),
            ("Marketing & Promotional Design", [], ""),
            ("Professional Design Workflow", [], ""),
        ],
    },
    {
        "slug": "web-development",
        "aliases": [],
        "title": "Web Development",
        "category": "Development",
        "price": 80000,
        "duration": "10 Weeks",
        "tagline": "Design, build and deploy responsive websites with modern web technologies.",
        "description": (
            "The Web Development programme teaches learners how to design, build "
            "and deploy responsive websites using modern web technologies."
        ),
        "outcomes": [
            "HTML", "CSS", "JavaScript", "Responsive design", "Git/GitHub",
            "Frontend development", "Backend fundamentals", "Databases", "APIs",
            "Deployment",
        ],
        "target_audience": "Aspiring frontend developers, web designers and technical founders.",
        "modules": [
            ("Web Development Fundamentals", [], ""),
            ("HTML", [], ""),
            ("CSS", [], ""),
            ("Responsive Web Design", [], ""),
            ("JavaScript", [], ""),
            ("Git & GitHub", [], ""),
            ("Frontend Development", [], ""),
            ("Backend & Database Fundamentals", [], ""),
            ("APIs", [], ""),
            ("Deployment & Hosting", [], ""),
        ],
    },
    {
        "slug": "artificial-intelligence",
        "aliases": [],
        "title": "Artificial Intelligence",
        "category": "Artificial Intelligence",
        "price": 80000,
        "duration": "8 Weeks",
        "tagline": "Use modern AI tools responsibly and productively in study, work and business.",
        "description": (
            "The AI programme introduces learners to artificial intelligence, modern "
            "AI tools and practical applications of AI in education, business, "
            "productivity and digital work. The focus is responsible, practical AI use."
        ),
        "outcomes": [
            "AI fundamentals", "Modern AI tools", "Prompt engineering",
            "AI for productivity", "AI for business", "AI ethics and responsible use",
        ],
        "target_audience": "Professionals, entrepreneurs and creators who want practical AI skills.",
        "modules": [
            ("Introduction to Artificial Intelligence", [
                "What is AI?", "History of AI", "AI vs automation",
                "Machine learning fundamentals", "Generative AI",
            ], ""),
            ("AI Tools & Applications", [
                "AI assistants", "AI productivity tools", "AI for research",
                "AI for content", "AI for business",
            ], ""),
            ("Prompt Engineering", [
                "Understanding prompts", "Prompt structure", "Context", "Instructions",
                "Iteration", "Evaluating AI responses",
            ], ""),
            ("AI for Productivity", [
                "Research", "Writing", "Planning", "Data assistance", "Presentations",
                "Workflow automation concepts",
            ], ""),
            ("AI for Business", [
                "Customer support", "Marketing", "Research", "Business processes",
                "Decision support",
            ], ""),
            ("AI & Data", [
                "Data and AI", "AI-assisted analysis", "Data interpretation", "Limitations",
            ], ""),
            ("AI Ethics", [
                "Bias", "Privacy", "Security", "Misinformation", "Responsible AI use",
                "Human oversight",
            ], ""),
            ("AI Projects", [], ""),
        ],
    },
    {
        "slug": "coding",
        "aliases": ["Coding", "Computer Programming"],
        "title": "Coding",
        "category": "Development",
        "price": 80000,
        "duration": "10 Weeks",
        "tagline": "Learn programming fundamentals and build practical software projects from scratch.",
        "description": (
            "The Coding programme introduces learners to the principles of computer "
            "programming and equips them with the practical skills required to "
            "develop software solutions."
        ),
        "outcomes": [
            "Programming concepts", "Computational thinking", "Variables and data types",
            "Conditions and loops", "Functions", "Data structures", "Debugging",
            "Files and external data", "Git and GitHub", "Project development",
        ],
        "target_audience": "Beginners, career changers and young professionals starting software development.",
        "modules": [
            ("Introduction to Coding & Computer Programming", [
                "What is coding?", "What is programming?",
                "How computers understand instructions", "Programming languages",
                "Software and applications", "Code editors and development environments",
                "Introduction to algorithms", "Computational thinking",
                "Problem-solving with code", "Writing your first program",
            ], "Students create and run their first simple program."),
            ("Programming Fundamentals", [
                "Syntax", "Variables", "Constants", "Data types", "Strings", "Numbers",
                "Boolean values", "Operators", "Expressions", "Input and output",
                "Comments", "Basic program structure",
            ], "Students create a simple interactive program that accepts information from a user and produces an output."),
            ("Conditional Logic & Decision Making", [
                "Understanding conditions", "if statements", "else", "else if",
                "Comparison operators", "Logical operators", "Nested conditions",
                "Decision-making in programs", "Writing logical rules",
            ], "Build a grade calculator, age checker, simple login system and eligibility checker."),
            ("Loops & Repetition", [
                "Understanding repetition", "for loops", "while loops", "Loop conditions",
                "Counters", "Nested loops", "Avoiding infinite loops",
                "Practical applications of loops",
            ], "Students automate repetitive tasks with a number generator, multiplication table, simple quiz and repeated calculations."),
            ("Functions & Modular Programming", [
                "What are functions?", "Creating functions", "Parameters", "Arguments",
                "Return values", "Scope", "Reusable code",
                "Breaking programs into smaller components",
                "Introduction to modular programming",
            ], "Students develop a multi-function program."),
            ("Data Structures", [
                "Understanding data structures", "Lists/arrays", "Dictionaries/objects",
                "Sets", "Working with collections of data", "Adding and removing data",
                "Searching data", "Sorting data", "Iterating through data",
            ], "Students create a small data-management program such as a student record system, contact list, inventory tracker or expense tracker."),
            ("Debugging, Errors & Problem Solving", [
                "Understanding programming errors", "Syntax errors", "Runtime errors",
                "Logical errors", "Reading error messages", "Debugging techniques",
                "Testing programs", "Finding and fixing bugs", "Writing better code",
                "Problem decomposition", "Algorithm improvement",
            ], "Students receive broken programs and identify, explain and fix the errors."),
            ("Files, Data & External Resources", [
                "Working with files", "Reading files", "Writing files",
                "Working with structured data", "Introduction to JSON",
                "Introduction to CSV", "Handling external data", "Basic data processing",
                "Introduction to APIs", "Using external resources in applications",
            ], "Students create a program that reads and processes external data."),
            ("Git, GitHub & Professional Coding Practices", [
                "What is version control?", "Introduction to Git", "GitHub",
                "Creating repositories", "Commits", "Branches", "Pull requests",
                "Collaboration", "Managing code versions", "Writing README files",
                "Organizing coding projects",
                "Introduction to professional development workflows",
            ], "Students publish a coding project on GitHub."),
            ("Coding Project Development", [
                "Understanding project requirements", "Problem identification",
                "Project planning", "Designing program logic", "Creating algorithms",
                "Writing the code", "Testing", "Debugging", "Improving the application",
                "Documentation", "Presenting a coding project",
            ], "Students develop a complete coding project that solves a practical problem, then present it."),
        ],
    },
]

KIDS_CURRICULUM = [
    {
        "slug": "kids-graphic-design",
        "aliases": ["Graphic Design for Kids"],
        "title": "Graphic Design for Kids",
        "category": "Kids Tech Academy",
        "price": 50000,
        "duration": "8 Weeks",
        "tagline": "A playful introduction to digital creativity, colour and design.",
        "description": (
            "Children are introduced to visual creativity and digital design in an "
            "engaging, project-based environment."
        ),
        "outcomes": ["Shapes", "Colours", "Typography", "Layout", "Digital drawing",
                     "Posters", "Simple branding", "Social graphics", "Creative projects"],
        "target_audience": "Children and young learners beginning their creative technology journey.",
        "modules": [
            ("Introduction to Digital Design", [], ""),
            ("Colours & Shapes", [], ""),
            ("Typography", [], ""),
            ("Layout & Composition", [], ""),
            ("Digital Illustration", [], ""),
            ("Poster Design", [], ""),
            ("Simple Branding", [], ""),
            ("Creative Portfolio", [], ""),
        ],
    },
    {
        "slug": "kids-ui-ux",
        "aliases": ["UI/UX Design for Kids"],
        "title": "UI/UX Design for Kids",
        "category": "Kids Tech Academy",
        "price": 50000,
        "duration": "8 Weeks",
        "tagline": "Children learn how apps are designed and create their own interfaces.",
        "description": (
            "Children learn how digital products are designed and begin creating "
            "their own interfaces."
        ),
        "outcomes": ["Understanding apps and websites", "User thinking", "Ideas and problem solving",
                     "Sketching interfaces", "Wireframes", "Colour and typography",
                     "App screens", "Prototyping"],
        "target_audience": "Children and young learners curious about app and web design.",
        "modules": [
            ("What Are Apps & Websites?", [], ""),
            ("Understanding Users", [], ""),
            ("Ideas & Problem Solving", [], ""),
            ("Sketching Interfaces", [], ""),
            ("Wireframes", [], ""),
            ("Colour & Typography", [], ""),
            ("Designing App Screens", [], ""),
            ("Creating a Prototype", [], ""),
        ],
    },
    {
        "slug": "kids-web-development",
        "aliases": ["Web Development for Kids", "Kids Web Development"],
        "title": "Web Development for Kids",
        "category": "Kids Tech Academy",
        "price": 50000,
        "duration": "8 Weeks",
        "tagline": "From how websites work to building and styling a first webpage.",
        "description": (
            "Children learn the fundamentals of how websites work and gradually "
            "build their own webpages."
        ),
        "outcomes": ["How the web works", "HTML", "Webpages", "CSS", "Styling",
                     "JavaScript basics", "Interactive websites"],
        "target_audience": "Children and young learners ready to build their first website.",
        "modules": [
            ("Introduction to the Web", [], ""),
            ("How Websites Work", [], ""),
            ("HTML Fundamentals", [], ""),
            ("Creating Webpages", [], ""),
            ("CSS Fundamentals", [], ""),
            ("Styling Websites", [], ""),
            ("Introduction to JavaScript", [], ""),
            ("Building an Interactive Website", [], ""),
        ],
    },
    {
        "slug": "kids-artificial-intelligence",
        "aliases": ["AI for Kids", "Artificial Intelligence for Kids"],
        "title": "Artificial Intelligence for Kids",
        "category": "Kids Tech Academy",
        "price": 50000,
        "duration": "8 Weeks",
        "tagline": "A safe, creative introduction to what AI is and how to use it responsibly.",
        "description": (
            "AI for Kids introduces young learners to artificial intelligence in a "
            "safe, age-appropriate and creative way. The goal is to understand what "
            "AI is, how it works at a basic level, what it can and cannot do, and how "
            "to use it responsibly."
        ),
        "outcomes": ["What AI is", "How computers learn", "Generative AI", "Prompting AI",
                     "AI creativity", "AI problem solving", "AI safety and ethics",
                     "An AI-assisted project"],
        "target_audience": "Children and young learners exploring AI safely.",
        "modules": [
            ("What is AI?", [
                "What artificial intelligence means", "Examples of AI around them",
                "AI in phones", "AI in games", "AI in education",
            ], ""),
            ("How Computers Learn", [
                "Data", "Patterns", "Instructions", "Machine learning concepts",
            ], ""),
            ("Exploring Generative AI", [
                "Text", "Images", "Ideas", "Creative projects",
            ], ""),
            ("Prompting AI", [
                "Giving clear instructions to AI", "Asking better questions",
                "Checking AI answers",
            ], ""),
            ("AI Creativity", [
                "Stories", "Images", "Ideas", "Presentations",
            ], ""),
            ("AI Problem Solving", [
                "Using AI to explore solutions to simple problems",
            ], ""),
            ("AI Safety & Ethics", [
                "Privacy", "Personal information", "Misinformation", "Bias",
                "Responsible use", "Human decision-making",
            ], ""),
            ("AI Project", [], ""),
        ],
    },
    {
        "slug": "kids-coding",
        "aliases": ["Coding for Kids"],
        "title": "Coding for Kids",
        "category": "Kids Tech Academy",
        "price": 50000,
        "duration": "8 Weeks",
        "tagline": "Creative, practical coding that turns children into problem-solvers and makers.",
        "description": (
            "The Coding for Kids programme introduces children to the fundamentals of "
            "computer programming through creative, practical and age-appropriate "
            "activities. Learners develop computational thinking, logical reasoning, "
            "problem-solving and creativity while building their own interactive projects."
        ),
        "outcomes": [
            "What coding is", "Computational thinking", "Algorithms", "Programming basics",
            "Variables", "Conditions", "Loops", "Functions and events",
            "Interactive projects", "Debugging", "Presenting a project",
        ],
        "target_audience": "Children and young learners beginning coding.",
        "modules": [
            ("Introduction to Coding", [
                "What is coding?", "What is a computer program?",
                "How computers follow instructions", "What programmers do",
                "Programming languages", "Coding in everyday life",
                "Games and applications created with code",
                "Introduction to computational thinking",
            ], "Children create their first simple coded project."),
            ("Computational Thinking & Problem Solving", [
                "What is a problem?", "Breaking problems into smaller parts",
                "Step-by-step thinking", "Algorithms", "Instructions", "Patterns",
                "Sequences", "Logical thinking", "Finding solutions",
            ], "Children create instructions for everyday tasks and convert them into simple algorithms."),
            ("Introduction to Programming", [
                "Commands", "Variables", "Values", "Numbers", "Text", "Input and output",
                "Simple calculations", "Basic programming logic",
            ], "Create a simple interactive program."),
            ("Conditions & Decision Making", [
                "Making decisions with code", "If/then logic", "Choices", "Conditions",
                "Comparing values", "Simple logical operators",
            ], "Children create an age checker, interactive quiz, choose-your-own-adventure story or simple decision game."),
            ("Loops & Repetition", [
                "What is repetition?", "Loops", "Repeating instructions", "Counters",
                "Patterns", "Automating repetitive actions",
            ], "Children create a pattern generator, drawing project, simple animation or repeating game actions."),
            ("Functions, Events & Interactivity", [
                "What is a function?", "Reusing code", "Events", "User interaction",
                "Buttons/actions", "Inputs", "Outputs", "Creating interactive projects",
            ], "Children create an interactive application or game."),
            ("Building Games & Creative Projects", [
                "Game ideas", "Characters", "Rules", "Scoring", "Levels", "Movement",
                "Interaction", "Game logic", "Testing games", "Improving gameplay",
            ], "Each learner builds a simple game and explains how their code works."),
            ("My Coding Project", [
                "Choosing a project idea", "Identifying the problem or purpose",
                "Planning the project", "Creating the design", "Writing the code",
                "Testing", "Finding bugs", "Fixing problems", "Improving the project",
                "Presenting the project",
            ], "Each child creates an original coding project and presents it."),
        ],
    },
]

CURRICULUM = ADULT_CURRICULUM + KIDS_CURRICULUM
