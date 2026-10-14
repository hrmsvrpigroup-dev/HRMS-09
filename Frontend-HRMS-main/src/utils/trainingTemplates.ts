export interface TrainingTemplate {
  id: string;
  name: string;
  category: string;
  badgeColor: string;
  defaultTitle: string;
  defaultTrainerName: string;
  defaultSenderName: string;
  defaultDuration: string;
  defaultTime: string;
  agenda: string;
  prerequisites: string;
  instructions: string;
  customMessage?: string;
}

export const TRAINING_TEMPLATES: TrainingTemplate[] = [
  {
    id: 'induction',
    name: 'New Hire Orientation & HRMS Walkthrough',
    category: 'HR & Onboarding',
    badgeColor: '#3b82f6',
    defaultTitle: 'Company Orientation & HRMS Platform Walkthrough',
    defaultTrainerName: 'HR Training & Development Lead',
    defaultSenderName: 'VR PI HR Induction Team',
    defaultDuration: '60 Minutes',
    defaultTime: '10:30 AM - 11:30 AM IST',
    agenda: `1. Welcome & Introduction to Company Vision & Culture\n2. HR Policies, Working Hours, & Leave Management System\n3. HRMS Portal Orientation (Attendance, Payslips, Documents)\n4. Benefits, Insurance, & Compliance Overview\n5. Open Q&A Session`,
    prerequisites: 'Please have your employee credentials and welcome packet handy.',
    instructions: 'Join via Microsoft Teams from a quiet workspace. Please enable camera during introduction round.',
    customMessage: 'Welcome to the team! We are thrilled to have you onboard and look forward to this interactive session.'
  },
  {
    id: 'tech_engineering',
    name: 'Technical & Engineering Architecture Workshop',
    category: 'Engineering & Tech',
    badgeColor: '#6366f1',
    defaultTitle: 'Microservices, Code Quality & CI/CD Pipelines Workshop',
    defaultTrainerName: 'Principal Software Architect',
    defaultSenderName: 'Engineering Excellence Academy',
    defaultDuration: '90 Minutes',
    defaultTime: '03:00 PM - 04:30 PM IST',
    agenda: `1. Repository Architecture & Coding Conventions\n2. Git Branching Model & Automated PR Review Pipelines\n3. Security Best Practices & Database Query Optimization\n4. Observability, Logging, & Production Deployment\n5. Live Code Walkthrough & Architecture Q&A`,
    prerequisites: 'Git repository access configured, local development environment running, and code editor ready.',
    instructions: 'Join via Microsoft Teams with screen sharing enabled. Hands-on coding session included.',
    customMessage: 'Mandatory technical session for all engineering team members and technical leads.'
  },
  {
    id: 'compliance_posh',
    name: 'Workplace Ethics & POSH Compliance Training',
    category: 'Compliance & Legal',
    badgeColor: '#ec4899',
    defaultTitle: 'Annual Workplace Ethics, POSH & Code of Conduct Session',
    defaultTrainerName: 'Legal & Compliance Officer',
    defaultSenderName: 'HR Compliance Committee',
    defaultDuration: '45 Minutes',
    defaultTime: '02:00 PM - 02:45 PM IST',
    agenda: `1. Understanding Workplace Harassment & Legal Framework (POSH Act)\n2. Safe, Respectful, & Inclusive Work Culture Standards\n3. Internal Complaints Committee (ICC) & Redressal Procedures\n4. Case Studies & Scenario Walkthroughs\n5. Compliance Undertaking & Interactive Quiz`,
    prerequisites: 'No prerequisites required.',
    instructions: 'Full attendance is mandatory as per statutory compliance guidelines. Attendance will be recorded via Microsoft Teams join logs.',
    customMessage: 'Annual mandatory statutory compliance training for all permanent and contractual employees.'
  },
  {
    id: 'agile_scrum',
    name: 'Agile Ceremonies & Sprint Management',
    category: 'Project Management',
    badgeColor: '#10b981',
    defaultTitle: 'Agile Sprint Planning, Jira Workflows & Delivery Excellence',
    defaultTrainerName: 'Agile Coach & Delivery Manager',
    defaultSenderName: 'Program Management Office (PMO)',
    defaultDuration: '60 Minutes',
    defaultTime: '11:00 AM - 12:00 PM IST',
    agenda: `1. Agile Values & Scrum Framework Fundamentals\n2. Story Point Estimation & Definition of Done (DoD)\n3. Effective Daily Standups & Retrospective Best Practices\n4. Jira Backlog Grooming & Sprint Tracking\n5. Continuous Feedback Loops & Team Velocity`,
    prerequisites: 'Access to project board on Jira / Task Assignment module.',
    instructions: 'Join via Microsoft Teams desktop client. Collaborative board link will be provided in meeting chat.',
    customMessage: 'Targeted for cross-functional project squads, developers, QA, and product managers.'
  },
  {
    id: 'leadership_softskills',
    name: 'Executive Communication & Leadership Mastery',
    category: 'Leadership & Soft Skills',
    badgeColor: '#f59e0b',
    defaultTitle: 'Cross-Functional Communication & Leadership Mastery',
    defaultTrainerName: 'Head of Talent & Organization Development',
    defaultSenderName: 'Executive Learning & Development',
    defaultDuration: '75 Minutes',
    defaultTime: '04:00 PM - 05:15 PM IST',
    agenda: `1. High-Impact Executive Communication & Active Listening\n2. Managing Stakeholder Expectations & Conflict Resolution\n3. Giving and Receiving Constructive Feedback\n4. Leading High-Performance Remote & Hybrid Teams\n5. Interactive Group Case Studies`,
    prerequisites: 'Come prepared to participate in small group breakout sessions.',
    instructions: 'Please join using a headset or microphone for interactive discussion.',
    customMessage: 'Designed to sharpen strategic interpersonal communication and leadership impact across teams.'
  },
  {
    id: 'infosec_data_privacy',
    name: 'Information Security & Data Protection (ISO/GDPR)',
    category: 'Information Security',
    badgeColor: '#0ea5e9',
    defaultTitle: 'Cybersecurity Awareness, Phishing Defense & Data Protection',
    defaultTrainerName: 'Chief Information Security Officer (CISO)',
    defaultSenderName: 'Information Security Team',
    defaultDuration: '45 Minutes',
    defaultTime: '02:30 PM - 03:15 PM IST',
    agenda: `1. Recognizing Social Engineering, Phishing, & Cyber Threats\n2. Secure Password Hygiene & Multi-Factor Authentication (MFA)\n3. Handling Confidential & Personally Identifiable Information (PII)\n4. Incident Reporting Protocols & Clean Desk Policy\n5. Security Compliance Certification`,
    prerequisites: 'Work device with updated security patches.',
    instructions: 'Interactive poll and completion acknowledgment will take place during the Microsoft Teams meeting.',
    customMessage: 'Essential information security awareness for maintaining enterprise ISO 27001 compliance standards.'
  },
  {
    id: 'custom_blank',
    name: 'Custom / Blank Training Session',
    category: 'Custom Session',
    badgeColor: '#8b5cf6',
    defaultTitle: 'Specialized Employee Development Session',
    defaultTrainerName: 'HR Training Lead',
    defaultSenderName: 'Corporate Training Academy',
    defaultDuration: '60 Minutes',
    defaultTime: '11:00 AM - 12:00 PM IST',
    agenda: `1. Introduction & Context Setting\n2. Key Subject Areas & Topic Breakdown\n3. Hands-on Exercises / Discussion\n4. Action Items & Key Takeaways\n5. Questions & Answers`,
    prerequisites: 'To be specified by session organizer.',
    instructions: 'Join through Microsoft Teams. Please join at least 5 minutes prior to the start time.',
    customMessage: 'Custom training invitation crafted for selected team members.'
  }
];
