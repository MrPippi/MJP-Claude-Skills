export type Language = 'zh-TW' | 'en';

export interface GuideStep {
  number: string;
  title: string;
  description: string;
  code?: string;
  triggers?: { keyword: string; skill: string }[];
  outputs?: string[];
  note: string;
}

export interface Translations {
  nav: { docs: string; skills: string; reference: string; gettingStarted: string };
  header: {
    searchPlaceholder: string;
    searchAriaLabel: string;
    menuAriaLabel: string;
    themeToLight: string;
    themeToDark: string;
    switchLang: string;
  };
  footer: {
    tagline: string;
    docs: string;
    resources: string;
    gettingStarted: string;
    allSkills: string;
    reference: string;
    githubProject: string;
    contributeGuide: string;
    license: string;
    disclaimer: string;
  };
  home: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    heroDescription: string;
    ctaPrimary: string;
    ctaSecondary: string;
    statsSkills: string;
    statsPlatforms: string;
    statsVersions: string;
    terminalTitle: string;
    terminalComment: string;
    terminalComment2: string;
    terminalPrompt: string;
    terminalResult: string;
    platformsLabel: string;
    platformsTitle: string;
    platformNmsDesc: string;
    platformApiDesc: string;
    platformSkills: string;
    platformSetup: string;
    stepsLabel: string;
    stepsTitle: string;
    steps: { title: string; body: string }[];
    featuredLabel: string;
    featuredTitle: string;
    viewAll: string;
    referenceLabel: string;
    referenceTitle: string;
    referenceSubtitle: string;
    ctaTitle: string;
    ctaDescription: string;
    ctaButton: string;
  };
  docs: {
    overviewLabel: string;
    overviewTitle: string;
    overviewDescription: string;
    sections: { start: string; platforms: string; concepts: string; skills: string; reference: string };
    sectionDescriptions: { start: string; platforms: string; concepts: string; skills: string; reference: string };
    editOnGithub: string;
    previous: string;
    next: string;
    toc: string;
    menu: string;
    closeMenu: string;
    pagesCount: string;
  };
  skills: {
    pageTitle: string;
    pageSubtitle: string;
    filterAll: string;
    filterPlatform: string;
    filterCategory: string;
    searchPlaceholder: string;
    emptyState: string;
    resultCount: string;
    clearFilters: string;
  };
  skillDetail: {
    updatedAt: string;
    version: string;
    triggers: string;
    tags: string;
    platformDoc: string;
  };
  gettingStarted: {
    label: string;
    title: string;
    description: string;
    stepsTitle: string;
    steps: GuideStep[];
    faqTitle: string;
    faqSubtitle: string;
    faqs: { q: string; a: string }[];
    ctaTitle: string;
    ctaDescription: string;
    ctaButton: string;
  };
  notFound: { title: string; description: string; backHome: string; browseDocs: string };
  search: {
    placeholder: string;
    emptyHint: string;
    noResults: string;
    skillsGroup: string;
    docsGroup: string;
    navHint: string;
    openHint: string;
    closeHint: string;
  };
  status: { active: string; deprecated: string };
  redirect: { moved: string; goNow: string };
}
