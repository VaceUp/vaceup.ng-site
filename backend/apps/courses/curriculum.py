"""Curriculum transcribed from the academy curriculum brief.

Every course is created unpublished. Each module carries the brief's topic
bullets and each topic becomes one lesson, so an admin can add notes, videos
and meeting links before publishing. Prices, durations and outcomes come from
the brief.

A module note is the brief's trailing line for that module (its Practical,
Activity or Project). It is stored as a (label, body) pair; ``label`` is empty
when the brief states the line without one.
"""

import re

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
            "The Virtual Assistant programme is designed to equip learners with "
            "the practical administrative, communication, digital productivity "
            "and client-support skills required to work effectively as a "
            "professional Virtual Assistant."
        ),
        "outcomes": [
            "Administrative support", "Email management", "Calendar management",
            "Internet research", "Document management", "Communication",
            "Meeting coordination", "Task management", "Customer support",
            "Digital productivity", "Client management", "Professional remote-work practices",
        ],
        "learning_outcome": (
            "By the end of the programme, learners should be able to operate as "
            "professional Virtual Assistants, manage administrative tasks remotely "
            "and demonstrate their capabilities through practical projects."
        ),
        "target_audience": "Aspiring virtual assistants, administrative officers and remote-work professionals.",
        "modules": [
            ("Introduction to Virtual Assistance", [
                "What is Virtual Assistance?", "The role of a Virtual Assistant",
                "Types of Virtual Assistants", "VA services", "Remote work fundamentals",
                "Understanding clients", "Professional expectations",
                "Skills required for VA success",
            ], None),
            ("Professional Communication", [
                "Professional email communication", "Business writing", "Client communication",
                "Tone and professionalism", "Communication etiquette",
                "Handling difficult conversations", "Meeting communication",
                "Written communication standards",
            ], None),
            ("Administrative Support", [
                "Document preparation", "File organization", "Data entry", "Scheduling",
                "Calendar management", "Meeting coordination", "Travel planning",
                "Administrative workflows",
            ], None),
            ("Digital Productivity Tools", [
                "Cloud storage", "Document collaboration", "Spreadsheets", "Task management",
                "Communication tools", "Scheduling tools", "Productivity systems",
                "Digital organization",
            ], ("Practical", "Create a complete digital workspace.")),
            ("Research & Information Management", [
                "Internet research", "Search techniques", "Information verification",
                "Data collection", "Research documentation", "Presenting findings",
                "Research ethics",
            ], None),
            ("Customer & Client Support", [
                "Customer service", "Client onboarding", "Managing client requests",
                "Ticket/task management", "Follow-ups", "Client satisfaction",
                "Handling complaints",
            ], None),
            ("Project & Task Management", [
                "Task prioritization", "Deadlines", "Workflow management", "Project tracking",
                "Delegation", "Reporting", "Productivity systems",
            ], None),
            ("Becoming a Professional VA", [
                "Creating a VA portfolio", "CV/resume", "Professional profile",
                "Personal branding", "Finding opportunities", "Client proposals",
                "Interview preparation", "Pricing basics", "Professional boundaries",
            ], None),
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
        "learning_outcome": None,
        "target_audience": "Aspiring data analysts, business analysts and reporting officers.",
        "modules": [
            ("Introduction to Data Analysis", [
                "What is data?", "Types of data", "Data analysis process",
                "Data analyst responsibilities", "Analytical thinking",
                "Data-driven decision-making",
            ], None),
            ("Excel / Spreadsheet Analysis", [
                "Spreadsheet fundamentals", "Formulas", "Functions", "Sorting and filtering",
                "Conditional formatting", "Data cleaning", "Pivot tables", "Charts",
            ], None),
            ("Data Cleaning & Preparation", [
                "Missing data", "Duplicates", "Inconsistent data", "Data formatting",
                "Data validation", "Preparing datasets for analysis",
            ], None),
            ("SQL", [
                "Databases", "Tables", "Queries", "SELECT", "WHERE", "GROUP BY",
                "ORDER BY", "JOINs", "Aggregations", "Practical database analysis",
            ], None),
            ("Data Visualization", [
                "Principles of visualization", "Charts", "Dashboards",
                "Choosing appropriate visualizations", "Data storytelling",
                "Presenting insights",
            ], None),
            ("BI / Dashboard Development", [
                "Dashboard concepts", "Connecting datasets", "Creating visualizations",
                "Filters", "Interactive dashboards", "Presenting business insights",
            ], None),
            ("Analytical Thinking", [
                "Asking analytical questions", "Identifying patterns", "Trends",
                "Relationships", "Business problems", "Generating insights",
            ], None),
            ("Data Portfolio", [
                "Data project documentation", "Portfolio presentation", "Case studies",
                "Presenting insights", "Preparing for data roles",
            ], None),
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
        "learning_outcome": None,
        "target_audience": "Aspiring product designers, UI/UX designers and frontend creatives.",
        "modules": [
            ("Introduction to UI/UX", [
                "UI vs UX", "Design thinking", "User-centred design", "Digital products",
                "UX process",
            ], None),
            ("UX Research", [
                "Understanding users", "Interviews", "Surveys", "Competitor research",
                "User problems", "Research documentation",
            ], None),
            ("User Personas & User Journeys", [
                "Personas", "User goals", "Pain points", "User journeys", "User flows",
            ], None),
            ("Information Architecture", [
                "Content structure", "Navigation", "Sitemap", "User flow",
                "Information hierarchy",
            ], None),
            ("Wireframing", [
                "Low-fidelity wireframes", "High-fidelity wireframes", "Layout",
                "Components", "Mobile-first thinking",
            ], None),
            ("UI Design", [
                "Typography", "Colour", "Spacing", "Visual hierarchy", "Grids",
                "Components", "Buttons", "Forms",
            ], None),
            ("Design Systems & Prototyping", [
                "Design systems", "Components", "Reusable elements",
                "Interactive prototypes", "Developer handoff",
            ], None),
            ("Usability Testing", [
                "Testing designs", "User feedback", "Identifying problems", "Iteration",
                "Improving usability",
            ], None),
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
            "technical skills required to create professional visual "
            "communication for brands, businesses and digital platforms."
        ),
        "outcomes": [
            "Design principles", "Typography", "Colour theory", "Layout", "Branding",
            "Social media design", "Marketing materials", "Digital graphics",
            "Portfolio development",
        ],
        "learning_outcome": None,
        "target_audience": "Aspiring graphic designers, social media creatives and brand assistants.",
        # The brief names these eight modules without listing their topics.
        "modules": [
            ("Fundamentals of Graphic Design", [], None),
            ("Colour Theory", [], None),
            ("Typography", [], None),
            ("Layout & Composition", [], None),
            ("Branding & Visual Identity", [], None),
            ("Social Media Design", [], None),
            ("Marketing & Promotional Design", [], None),
            ("Professional Design Workflow", [], None),
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
        "learning_outcome": None,
        "target_audience": "Aspiring frontend developers, web designers and technical founders.",
        # The brief names these ten modules without listing their topics.
        "modules": [
            ("Web Development Fundamentals", [], None),
            ("HTML", [], None),
            ("CSS", [], None),
            ("Responsive Web Design", [], None),
            ("JavaScript", [], None),
            ("Git & GitHub", [], None),
            ("Frontend Development", [], None),
            ("Backend & Database Fundamentals", [], None),
            ("APIs", [], None),
            ("Deployment & Hosting", [], None),
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
            "The AI programme introduces learners to artificial intelligence, "
            "modern AI tools and practical applications of AI in education, "
            "business, productivity and digital work. The course should focus on "
            "responsible and practical AI use, rather than simply teaching "
            "learners how to use individual AI tools."
        ),
        # The brief lists no separate outcome bullets for this course, so the
        # module headings stand as the published learning outcomes.
        "outcomes": [
            "Introduction to Artificial Intelligence", "AI Tools & Applications",
            "Prompt Engineering", "AI for Productivity", "AI for Business",
            "AI & Data", "AI Ethics", "AI Projects",
        ],
        "learning_outcome": None,
        "target_audience": "Professionals, entrepreneurs and creators who want practical AI skills.",
        "modules": [
            ("Introduction to Artificial Intelligence", [
                "What is AI?", "History of AI", "AI vs automation",
                "Machine learning fundamentals", "Generative AI",
            ], None),
            ("AI Tools & Applications", [
                "AI assistants", "AI productivity tools", "AI for research",
                "AI for content", "AI for business",
            ], None),
            ("Prompt Engineering", [
                "Understanding prompts", "Prompt structure", "Context", "Instructions",
                "Iteration", "Evaluating AI responses",
            ], None),
            ("AI for Productivity", [
                "Research", "Writing", "Planning", "Data assistance", "Presentations",
                "Workflow automation concepts",
            ], None),
            ("AI for Business", [
                "Customer support", "Marketing", "Research", "Business processes",
                "Decision support",
            ], None),
            ("AI & Data", [
                "Data and AI", "AI-assisted analysis", "Data interpretation", "Limitations",
            ], None),
            ("AI Ethics", [
                "Bias", "Privacy", "Security", "Misinformation", "Responsible AI use",
                "Human oversight",
            ], None),
            ("AI Projects", [], None),
        ],
    },
    {
        "slug": "coding",
        "aliases": ["Computer Programming"],
        "title": "Coding",
        "category": "Development",
        "price": 80000,
        "duration": "10 Weeks",
        "tagline": "Learn programming fundamentals and build practical software projects from scratch.",
        "description": (
            "The Coding programme is designed to introduce learners to the "
            "principles of computer programming and equip them with the "
            "practical skills required to develop software solutions."
        ),
        "outcomes": [
            "Understand programming concepts", "Think computationally",
            "Write and understand code", "Use variables and data types",
            "Work with conditions and loops", "Create functions",
            "Work with data structures", "Debug programs",
            "Use programming tools and development environments",
            "Work with files and external data", "Build practical software projects",
            "Use Git and GitHub for code management",
            "Apply programming knowledge to real-world problems",
        ],
        "learning_outcome": (
            "By the end of the programme, learners should be able to understand "
            "core programming concepts, write functional programs, solve problems "
            "using code, debug their programs, use version control, and develop "
            "practical coding projects that demonstrate their programming ability."
        ),
        "target_audience": "Beginners, career changers and young professionals starting software development.",
        "modules": [
            ("Introduction to Coding & Computer Programming", [
                "What is coding?", "What is programming?",
                "How computers understand instructions", "Programming languages",
                "Software and applications", "Code editors and development environments",
                "Introduction to algorithms", "Computational thinking",
                "Problem-solving with code", "Writing your first program",
            ], ("Practical", "Students create and run their first simple program.")),
            ("Programming Fundamentals", [
                "Syntax", "Variables", "Constants", "Data types", "Strings", "Numbers",
                "Boolean values", "Operators", "Expressions", "Input and output",
                "Comments", "Basic program structure",
            ], ("Practical", "Students create a simple interactive program that accepts information from a user and produces an output.")),
            ("Conditional Logic & Decision Making", [
                "Understanding conditions", "if statements", "else", "else if",
                "Comparison operators", "Logical operators", "Nested conditions",
                "Decision-making in programs", "Writing logical rules",
            ], ("Practical", "Build programs such as:\n- Grade calculator\n- Age checker\n- Simple login system\n- Eligibility checker")),
            ("Loops & Repetition", [
                "Understanding repetition", "for loops", "while loops", "Loop conditions",
                "Counters", "Nested loops", "Avoiding infinite loops",
                "Practical applications of loops",
            ], ("Practical", "Students build programs that automate repetitive tasks.\nExamples:\n- Number generator\n- Multiplication table\n- Simple quiz\n- Repeated calculations")),
            ("Functions & Modular Programming", [
                "What are functions?", "Creating functions", "Parameters", "Arguments",
                "Return values", "Scope", "Reusable code",
                "Breaking programs into smaller components",
                "Introduction to modular programming",
            ], ("Practical", "Students develop a multi-function program.")),
            ("Data Structures", [
                "Understanding data structures", "Lists/arrays", "Dictionaries/objects",
                "Sets", "Working with collections of data", "Adding and removing data",
                "Searching data", "Sorting data", "Iterating through data",
            ], ("Practical", "Students create a small data-management program.\nExamples:\n- Student record system\n- Contact list\n- Inventory tracker\n- Simple expense tracker")),
            ("Debugging, Errors & Problem Solving", [
                "Understanding programming errors", "Syntax errors", "Runtime errors",
                "Logical errors", "Reading error messages", "Debugging techniques",
                "Testing programs", "Finding and fixing bugs", "Writing better code",
                "Problem decomposition", "Algorithm improvement",
            ], ("Practical", "Students receive broken programs and identify, explain and fix the errors.")),
            ("Files, Data & External Resources", [
                "Working with files", "Reading files", "Writing files",
                "Working with structured data", "Introduction to JSON",
                "Introduction to CSV", "Handling external data", "Basic data processing",
                "Introduction to APIs", "Using external resources in applications",
            ], ("Practical", "Students create a program that reads and processes external data.")),
            ("Git, GitHub & Professional Coding Practices", [
                "What is version control?", "Introduction to Git", "GitHub",
                "Creating repositories", "Commits", "Branches", "Pull requests",
                "Collaboration", "Managing code versions", "Writing README files",
                "Organizing coding projects",
                "Introduction to professional development workflows",
            ], ("Practical", "Students publish a coding project on GitHub.")),
            ("Coding Project Development", [
                "Understanding project requirements", "Problem identification",
                "Project planning", "Designing program logic", "Creating algorithms",
                "Writing the code", "Testing", "Debugging", "Improving the application",
                "Documentation", "Presenting a coding project",
            ], ("Final Project", "Students develop a complete coding project that solves a practical problem.\nExamples could include:\n- Student Management System\n- Expense Tracker\n- Quiz Application\n- To-Do Application\n- Inventory Management System\n- Calculator\n- Simple Game\n- Contact Management System")),
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
        "outcomes": [
            "Shapes", "Colours", "Typography", "Layout", "Digital drawing",
            "Posters", "Simple branding", "Social graphics", "Creative projects",
        ],
        "learning_outcome": None,
        "target_audience": "Children and young learners beginning their creative technology journey.",
        # The brief names these eight modules without listing their topics.
        "modules": [
            ("Introduction to Digital Design", [], None),
            ("Colours & Shapes", [], None),
            ("Typography", [], None),
            ("Layout & Composition", [], None),
            ("Digital Illustration", [], None),
            ("Poster Design", [], None),
            ("Simple Branding", [], None),
            ("Creative Portfolio", [], None),
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
        # The brief names these eight modules without listing their topics.
        "outcomes": [
            "What Are Apps & Websites?", "Understanding Users",
            "Ideas & Problem Solving", "Sketching Interfaces", "Wireframes",
            "Colour & Typography", "Designing App Screens", "Creating a Prototype",
        ],
        "learning_outcome": None,
        "target_audience": "Children and young learners curious about app and web design.",
        "modules": [
            ("What Are Apps & Websites?", [], None),
            ("Understanding Users", [], None),
            ("Ideas & Problem Solving", [], None),
            ("Sketching Interfaces", [], None),
            ("Wireframes", [], None),
            ("Colour & Typography", [], None),
            ("Designing App Screens", [], None),
            ("Creating a Prototype", [], None),
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
        # The brief names these eight modules without listing their topics.
        "outcomes": [
            "Introduction to the Web", "How Websites Work", "HTML Fundamentals",
            "Creating Webpages", "CSS Fundamentals", "Styling Websites",
            "Introduction to JavaScript", "Building an Interactive Website",
        ],
        "learning_outcome": None,
        "target_audience": "Children and young learners ready to build their first website.",
        "modules": [
            ("Introduction to the Web", [], None),
            ("How Websites Work", [], None),
            ("HTML Fundamentals", [], None),
            ("Creating Webpages", [], None),
            ("CSS Fundamentals", [], None),
            ("Styling Websites", [], None),
            ("Introduction to JavaScript", [], None),
            ("Building an Interactive Website", [], None),
        ],
    },
    {
        "slug": "kids-artificial-intelligence",
        "aliases": ["AI for Kids"],
        "title": "Artificial Intelligence for Kids",
        "category": "Kids Tech Academy",
        "price": 50000,
        "duration": "8 Weeks",
        "tagline": "A safe, creative introduction to what AI is and how to use it responsibly.",
        "description": (
            "AI for Kids introduces young learners to artificial intelligence in a "
            "safe, age-appropriate and creative way. The goal is not simply to "
            "teach children how to use AI tools. The goal is to help them "
            "understand what AI is, how AI works at a basic level, what AI can "
            "do, what AI cannot do, and how to use AI responsibly."
        ),
        "outcomes": [
            "What is AI?", "How Computers Learn", "Exploring Generative AI",
            "Prompting AI", "AI Creativity", "AI Problem Solving",
            "AI Safety & Ethics", "AI Project",
        ],
        "learning_outcome": None,
        "target_audience": "Children and young learners exploring AI safely.",
        "modules": [
            ("What is AI?", [
                "What artificial intelligence means", "Examples of AI around them",
                "AI in phones", "AI in games", "AI in education",
            ], None),
            ("How Computers Learn", [
                "Data", "Patterns", "Instructions", "Machine learning concepts",
            ], None),
            ("Exploring Generative AI", [
                "Text", "Images", "Ideas", "Creative projects",
            ], None),
            ("Prompting AI", [], ("", "Children learn how to give clear instructions to AI.")),
            ("AI Creativity", [
                "Stories", "Images", "Ideas", "Presentations",
            ], None),
            ("AI Problem Solving", [], ("", "Children use AI to explore solutions to simple problems.")),
            ("AI Safety & Ethics", [
                "Privacy", "Personal information", "Misinformation", "Bias",
                "Responsible use", "Human decision-making",
            ], None),
            ("AI Project", [], ("", "Children create an age-appropriate AI-assisted project and explain what they learned.")),
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
            "The Coding for Kids programme introduces children to the fundamentals "
            "of computer programming through creative, practical and "
            "age-appropriate activities. Learners develop computational thinking, "
            "logical reasoning, problem-solving and creativity while learning how "
            "to give instructions to computers and build their own interactive "
            "projects."
        ),
        "outcomes": [
            "Introduction to coding and programming", "Computational thinking",
            "Algorithms and step-by-step problem solving", "Programming fundamentals",
            "Variables and basic data", "Conditions and decision-making",
            "Loops and repetition", "Functions and events", "Interactive projects",
            "Game development concepts", "Debugging and improving programs",
            "Creative coding projects", "Project planning and presentation",
        ],
        "learning_outcome": (
            "By the end of the programme, learners should be able to understand "
            "basic programming concepts, think logically, create simple programs "
            "and interactive projects, solve problems using code, identify and fix "
            "simple errors, and confidently present a coding project they have "
            "created. The focus is not just on learning how to code, but on "
            "helping children become creative problem-solvers and technology "
            "creators."
        ),
        "target_audience": "Children and young learners beginning coding.",
        "modules": [
            ("Introduction to Coding", [
                "What is coding?", "What is a computer program?",
                "How computers follow instructions", "What programmers do",
                "Programming languages", "Coding in everyday life",
                "Games and applications created with code",
                "Introduction to computational thinking",
            ], ("Activity", "Children create their first simple coded project.")),
            ("Computational Thinking & Problem Solving", [
                "What is a problem?", "Breaking problems into smaller parts",
                "Step-by-step thinking", "Algorithms", "Instructions", "Patterns",
                "Sequences", "Logical thinking", "Finding solutions",
            ], ("Activity", "Children create instructions for completing everyday tasks and convert them into simple algorithms.")),
            ("Introduction to Programming", [
                "Commands", "Variables", "Values", "Numbers", "Text", "Input and output",
                "Simple calculations", "Basic programming logic",
            ], ("Activity", "Create a simple interactive program.")),
            ("Conditions & Decision Making", [
                "Making decisions with code", "If/then logic", "Choices", "Conditions",
                "Comparing values", "Simple logical operators",
            ], ("Projects", "Children can create:\n- Age checker\n- Interactive quiz\n- Choose-your-own-adventure story\n- Simple decision game")),
            ("Loops & Repetition", [
                "What is repetition?", "Loops", "Repeating instructions", "Counters",
                "Patterns", "Automating repetitive actions",
            ], ("Projects", "Children create:\n- Pattern generator\n- Drawing project\n- Simple animation\n- Repeating game actions")),
            ("Functions, Events & Interactivity", [
                "What is a function?", "Reusing code", "Events", "User interaction",
                "Buttons/actions", "Inputs", "Outputs", "Creating interactive projects",
            ], ("Project", "Children create an interactive application or game.")),
            ("Building Games & Creative Projects", [
                "Game ideas", "Characters", "Rules", "Scoring", "Levels", "Movement",
                "Interaction", "Game logic", "Testing games", "Improving gameplay",
            ], ("Project", "Build My Own Game\nEach learner creates a simple game and explains how their code works.")),
            ("My Coding Project", [
                "Choosing a project idea", "Identifying the problem or purpose",
                "Planning the project", "Creating the design", "Writing the code",
                "Testing", "Finding bugs", "Fixing problems", "Improving the project",
                "Presenting the project",
            ], ("Final Project", "Each child creates an original coding project.\nPossible projects:\n- My Own Game\n- Quiz Game\n- Story Game\n- Calculator\n- Animation\n- Interactive Story\n- Simple Educational Game\n- Digital Pet\n- Problem-Solving App")),
        ],
    },
]

CURRICULUM = ADULT_CURRICULUM + KIDS_CURRICULUM


def brief_outcomes(item):
    """Published learning outcomes for a course in the brief."""
    outcomes = [line for line in item.get("outcomes", []) if line]
    learning_outcome = item.get("learning_outcome")
    if learning_outcome:
        outcomes.append(f"Learning outcome: {learning_outcome}")
    return outcomes


def normalise(title):
    """Compare titles loosely: case, spacing and a "Module 3:" prefix."""
    text = re.sub(r"^module\s+\d+\s*[-:.]?\s*", "", title.strip().lower())
    text = re.sub(r"^\d+[.)]\s*", "", text)
    return re.sub(r"\s+", " ", text).strip()


def brief_outline(item):
    """The public syllabus: every module with its topics and closing note."""
    sections = []
    for week, (title, topics, note) in enumerate(item["modules"], start=1):
        lines = [f"Week {week} - {title}"]
        lines += [f"- {topic}" for topic in topics]
        if note:
            lines.append(f"{note[0]}: {note[1]}" if note[0] else note[1])
        sections.append("\n".join(lines))
    return "\n\n".join(sections)


def note_content(note):
    """The module's practical or project line, written for the learner."""
    if not note:
        return ""
    label, body = note
    return f"{label}:\n{body}" if label else body


def expected_lessons(item):
    """How many lessons the brief asks for in this course."""
    total = 0
    for _, topics, note in item["modules"]:
        if topics:
            total += len(topics)
        elif note:
            total += 1
    return total
