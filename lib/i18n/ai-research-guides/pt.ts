import type {
  AiResearchGuidesContent,
  SeoLandingPageContentI18n,
  SeoLandingPageUi,
} from "@/lib/i18n/ai-research-guides/types";

const SHARED_FEATURES = [
  {
    title: "Citações com base nas fontes",
    body: "As respostas referenciam os instrumentos da biblioteca para que possa abrir o estatuto subjacente e verificar a resposta.",
  },
  {
    title: "Biblioteca jurídica com 54 países",
    body: "A pesquisa assenta numa biblioteca jurídica africana em expansão — pesquisável por país, tema e estado.",
  },
  {
    title: "Enquadramentos regionais",
    body: "A ZLECAf, a OHADA, a CEDEAO e outros textos supranacionais estão no âmbito quando aparecem nos excertos recuperados.",
  },
  {
    title: "Concebido para profissionais",
    body: "Pensado para escritórios de advocacia, equipas comerciais e estudantes que precisam de orientação rápida — com caminhos para aconselhamento humano através do diretório de advogados.",
  },
] as const;

const SHARED_FAQS = [
  {
    question: "O que é a pesquisa jurídica por IA na África?",
    answer:
      "A pesquisa jurídica por IA na África utiliza inteligência artificial para ajudá-lo a encontrar e interpretar regras jurídicas nas jurisdições africanas. A Yamalé concentra-se em respostas fundamentadas em fontes primárias da sua biblioteca jurídica — estatutos e regulamentos — em vez de texto web genérico sem citação.",
  },
  {
    question: "Em que é que a Yamalé difere do ChatGPT para o direito africano?",
    answer:
      "Os modelos de IA genéricos podem inventar ou aplicar mal as regras. A Yamalé recupera excertos da sua biblioteca jurídica africana e pede ao modelo que responda apenas com base nesses textos, com citações dos instrumentos utilizados. É um assistente de pesquisa sobre a sua biblioteca, e não um substituto do julgamento profissional.",
  },
  {
    question: "Que países e temas a Yamalé cobre?",
    answer:
      "A biblioteca visa uma cobertura ampla dos países africanos, com profundidade variável por jurisdição e tema. Os Estados membros da OHADA, os instrumentos da ZLECAf e as principais categorias comerciais, laborais e de comércio estão a ser expandidos ativamente. Consulte a biblioteca ou faça uma pergunta específica sobre um país para ver o que está disponível hoje.",
  },
  {
    question: "A Yamalé substitui um advogado?",
    answer:
      "Não. A Yamalé acelera a pesquisa e ajuda-o a localizar instrumentos relevantes. Não fornece aconselhamento jurídico. Para assuntos que exijam representação ou pareceres formais, utilize o diretório de advogados comerciais ou o seu próprio conselheiro.",
  },
  {
    question: "Como começo a usar a pesquisa jurídica por IA na Yamalé?",
    answer:
      "Abra a Pesquisa IA, inicie sessão e faça uma pergunta que indique o país e o tema — por exemplo, direito do trabalho em Moçambique ou registo de empresa em Gana. Os planos com consultas IA estão listados na página de preços.",
  },
] as const;

export const PT_AI_RESEARCH_GUIDES: AiResearchGuidesContent = {
  eyebrow: "Pesquisa jurídica IA Yamalé",
  h1: "Pesquisa jurídica por IA na África — respostas fundamentadas em fontes primárias",
  heroSubtitleSignedOut:
    "Inicie sessão para subscrever ou comprar uma consulta IA individual. Os planos incluem créditos mensais de pesquisa jurídica por IA fundamentados na biblioteca jurídica africana Yamalé.",
  whatYouGet: "O que obtém",
  faqTitle: "Perguntas frequentes",
  exploreGuides: "Explorar guias",
  exploreGuidesAria: "Guias de pesquisa IA",
  intro: [
    "A Yamalé é uma plataforma de pesquisa jurídica por IA concebida para a África. Faça perguntas em linguagem corrente e receba respostas extraídas de estatutos, regulamentos e instrumentos regionais da Biblioteca Jurídica Yamalé — e não de resumos web genéricos.",
    "Ao contrário dos chatbots de uso geral, a pesquisa jurídica IA da Yamalé cita os textos da biblioteca que utiliza. Isso importa para advogados, juristas internos, equipas de conformidade e estudantes de direito que precisam de saber qual instrumento sustenta uma resposta antes de confiar nela num parecer, processo ou exame.",
    "A cobertura abrange o direito nacional nas jurisdições africanas, o direito comercial OHADA, as regras comerciais da ZLECAf e outros enquadramentos regionais quando aparecem na biblioteca. Quando o estatuto de um país ainda não está no corpus, o assistente deve indicá-lo — e não substituir o direito nacional de outro país.",
  ],
  features: [...SHARED_FEATURES],
  faqs: [...SHARED_FAQS],
  relatedLinks: [
    { href: "/ai-legal-search-africa", label: "Pesquisa jurídica por IA na África" },
    { href: "/ohada-ai-legal-research", label: "Pesquisa jurídica IA OHADA" },
    { href: "/afcfta-ai-legal-research", label: "Pesquisa jurídica IA ZLECAf" },
    { href: "/african-legal-library-ai", label: "Biblioteca jurídica africana com IA" },
    { href: "/library", label: "Explorar a biblioteca jurídica" },
    { href: "/pricing", label: "Ver planos" },
  ],
};

export const PT_SEO_PAGE_UI: SeoLandingPageUi = {
  backToPlatform: "Plataforma jurídica Yamalé",
  tryAiResearch: "Experimentar a pesquisa IA",
  browseLibrary: "Explorar a biblioteca",
  whyTeams: "Porque as equipas usam a Yamalé",
  faqTitle: "Perguntas frequentes",
  related: "Relacionado",
  relatedAria: "Páginas relacionadas",
  viewPricing: "Ver preços",
  contactUs: "Contacte-nos",
};

export const PT_SEO_LANDING_PAGES: Record<string, SeoLandingPageContentI18n> = {
  aiLegalSearchAfrica: {
    metaTitle: "Pesquisa jurídica por IA na África — pesquisa com base nas fontes | Yamalé",
    metaDescription:
      "Pesquisa jurídica por IA na África fundamentada em estatutos e regulamentos. A Yamalé cita fontes primárias africanas da sua biblioteca jurídica — para advogados, equipas e estudantes.",
    keywords: [
      "pesquisa jurídica IA África",
      "pesquisa jurídica IA na África",
      "IA jurídica africana",
      "pesquisa jurídica África IA",
    ],
    eyebrow: "Pesquisa jurídica IA · África",
    h1: "Pesquisa jurídica por IA na África — fundamentada em estatutos, não em suposições",
    intro: [
      "Pesquisar o direito africano não deveria significar percorrer PDFs sem fim ou confiar num chatbot sem fontes. A Yamalé combina pesquisa jurídica por IA com uma biblioteca jurídica africana dedicada para que as respostas possam apontar para os instrumentos em que se baseiam.",
      "Quer trabalhe em comércio transfronteiriço, conformidade local ou estudo académico, pode fazer perguntas em linguagem natural e rever estatutos e regulamentos citados. A plataforma é construída na África e concebida para a forma como as regras continentais e nacionais se articulam — direito interno, comunidades económicas regionais, OHADA e ZLECAf.",
      "Comece com um país e um tema específicos para melhores resultados. A Yamalé expande continuamente a cobertura do corpus; quando um texto não está na biblioteca, o assistente de pesquisa deve reconhecer essa lacuna em vez de substituir o direito de outro país.",
    ],
    features: [...SHARED_FEATURES],
    faqs: [...SHARED_FAQS],
    relatedLinks: [
      { href: "/ai-research", label: "Abrir a pesquisa IA" },
      { href: "/library", label: "Biblioteca jurídica africana" },
      { href: "/ohada-ai-legal-research", label: "Pesquisa IA OHADA" },
      { href: "/afcfta-ai-legal-research", label: "Pesquisa IA ZLECAf" },
    ],
  },
  ohada: {
    metaTitle: "Pesquisa jurídica IA OHADA — atos uniformes e direito comercial | Yamalé",
    metaDescription:
      "Pesquise atos uniformes OHADA e direito comercial com IA fundamentada nos textos da biblioteca. Direito societário, direito comercial e instrumentos OHADA com citações.",
    keywords: [
      "pesquisa jurídica IA OHADA",
      "direito OHADA IA",
      "pesquisa atos uniformes OHADA",
      "direito comercial OHADA",
    ],
    eyebrow: "OHADA · pesquisa jurídica IA",
    h1: "Pesquisa jurídica IA OHADA em fontes primárias",
    intro: [
      "A OHADA harmoniza o direito comercial entre os Estados membros. A Yamalé ajuda-o a pesquisar e interpretar os atos uniformes OHADA e instrumentos relacionados com IA limitada aos excertos da biblioteca — para que possa rastrear as respostas até ao próprio ato.",
      "Utilize a pesquisa jurídica IA OHADA para constituição de sociedades, contratos comerciais, arbitragem e operações transfronteiriças na zona OHADA. Combine consultas IA com a navegação direta na biblioteca quando precisar do texto integral de um ato ou artigo.",
      "Para regras nacionais que coexistem com os textos OHADA, indique o Estado membro na sua pergunta. Os instrumentos regionais e o direito nacional de aplicação são tratados de forma diferente; a Yamalé prioriza os instrumentos efetivamente recuperados para a sua consulta.",
    ],
    features: [
      {
        title: "Atos uniformes na biblioteca",
        body: "Pesquise o direito societário OHADA, o direito comercial e textos relacionados juntamente com a legislação nacional de aplicação, quando disponível.",
      },
      {
        title: "Respostas citadas",
        body: "As respostas da IA referenciam documentos da biblioteca para que possa verificar artigos e definições em contexto.",
      },
      {
        title: "Fluxo de trabalho do profissional",
        body: "Passe do resumo IA ao texto integral do instrumento na biblioteca sem sair da plataforma.",
      },
      {
        title: "Uso francófono e anglófono",
        body: "Faça perguntas na língua em que trabalha; concentre-se na questão jurídica e na jurisdição para uma melhor recuperação.",
      },
    ],
    faqs: [
      {
        question: "A Yamalé pode responder a questões de direito societário OHADA?",
        answer:
          "Sim, quando os atos uniformes OHADA relevantes e os excertos correspondentes estão na biblioteca. Faça uma pergunta específica — por exemplo, deveres dos administradores no direito societário OHADA — e reveja os instrumentos citados na resposta.",
      },
      {
        question: "A pesquisa IA OHADA substitui a leitura do ato uniforme?",
        answer:
          "Não. A pesquisa IA ajuda-o a localizar e orientar-se mais rapidamente nos textos OHADA. Leia sempre as disposições citadas e confirme atualizações ou variações nacionais antes de aconselhar clientes.",
      },
      {
        question: "Que países OHADA são suportados?",
        answer:
          "Os Estados membros da OHADA partilham atos uniformes; as medidas nacionais de aplicação podem diferir. Indique o país na sua consulta quando precisar de contexto nacional juntamente com as regras OHADA.",
      },
      {
        question: "Como experimentar a pesquisa jurídica IA OHADA?",
        answer:
          "Inicie sessão na Pesquisa IA na Yamalé e faça uma pergunta focada na OHADA, ou explore primeiro os instrumentos OHADA na biblioteca.",
      },
    ],
    relatedLinks: [
      { href: "/ai-research", label: "Abrir a pesquisa IA" },
      { href: "/library", label: "Explorar textos OHADA" },
      { href: "/ai-legal-search-africa", label: "Pesquisa jurídica por IA na África" },
    ],
  },
  afcfta: {
    metaTitle: "Pesquisa jurídica IA ZLECAf — regras comerciais e conformidade | Yamalé",
    metaDescription:
      "Pesquisa jurídica por IA para regras de origem ZLECAf, escalões tarifários e conformidade comercial — fundamentada nas fontes da biblioteca Yamalé com citações.",
    keywords: [
      "pesquisa jurídica IA ZLECAf",
      "conformidade ZLECAf IA",
      "regras de origem ZLECAf",
      "direito comercial africano IA",
    ],
    eyebrow: "ZLECAf · pesquisa jurídica IA",
    h1: "Pesquisa jurídica IA ZLECAf para equipas de comércio e conformidade",
    intro: [
      "A Zona de Comércio Livre Continental Africana altera a forma como as empresas abordam as regras de origem, tarifas e acesso aos mercados. A Yamalé suporta pesquisa jurídica IA ZLECAf com base em instrumentos comerciais e textos relacionados da biblioteca.",
      "Responsáveis de conformidade e advogados comerciais podem fazer perguntas direcionadas — certificados de origem, elegibilidade de produtos, calendários de redução tarifária — e receber respostas ligadas às fontes ZLECAf e relacionadas recuperadas. Utilize as ferramentas ZLECAf dedicadas da plataforma para fluxos de conformidade estruturados em conjunto com a pesquisa IA.",
      "Combine consultas IA com as ferramentas de verificação de conformidade e escalão tarifário quando precisar de fluxos interativos, e não apenas de respostas narrativas.",
    ],
    features: [
      {
        title: "Recuperação focada no comércio",
        body: "As perguntas sobre instrumentos ZLECAf baseiam-se nos textos da biblioteca em vez de dados de treino genéricos.",
      },
      {
        title: "Ferramentas de conformidade",
        body: "Utilize a verificação de conformidade ZLECAf e ferramentas de percurso comercial juntamente com a pesquisa IA para fluxos de ponta a ponta.",
      },
      {
        title: "Contexto transfronteiriço",
        body: "Formule perguntas com produto, corredor e Estados membros para uma recuperação mais precisa.",
      },
      {
        title: "Resultados citáveis",
        body: "Reveja quais instrumentos o modelo utilizou antes de confiar numa resposta em processos ou pareceres a clientes.",
      },
    ],
    faqs: [
      {
        question: "A Yamalé pode ajudar com as regras de origem ZLECAf?",
        answer:
          "A Yamalé pode ajudá-lo a orientar-se nas regras ZLECAf quando os textos relevantes estão na biblioteca. Faça uma pergunta específica sobre o produto e o corredor e verifique as citações face aos instrumentos oficiais.",
      },
      {
        question: "Existe uma ferramenta de conformidade ZLECAf separada?",
        answer:
          "Sim. A Yamalé oferece verificação de conformidade ZLECAf e ferramentas relacionadas além da pesquisa jurídica IA. Utilize ambas quando precisar de verificações estruturadas e perguntas e respostas livres.",
      },
      {
        question: "Para quem é a pesquisa IA ZLECAf?",
        answer:
          "Para exportadores, importadores, equipas comerciais internas, consultores aduaneiros e advogados que aconselham sobre acesso aos mercados africanos.",
      },
    ],
    relatedLinks: [
      { href: "/ai-research", label: "Abrir a pesquisa IA" },
      { href: "/afcfta/compliance-check", label: "Verificação de conformidade ZLECAf" },
      { href: "/afcfta/tariff-schedule", label: "Ferramenta de escalão tarifário" },
      { href: "/ai-legal-search-africa", label: "Pesquisa jurídica por IA na África" },
    ],
  },
  africanLegalLibraryAi: {
    metaTitle: "Biblioteca jurídica africana com IA — pesquisar estatutos por país | Yamalé",
    metaDescription:
      "Explore e pesquise estatutos africanos em 54 países e execute pesquisa jurídica por IA nas mesmas fontes primárias. Uma plataforma para a biblioteca e respostas IA citadas.",
    keywords: [
      "biblioteca jurídica africana IA",
      "base de dados direito africano",
      "pesquisar estatutos africanos",
      "biblioteca jurídica África",
    ],
    eyebrow: "Biblioteca jurídica · pesquisa IA",
    h1: "Biblioteca jurídica africana com IA — pesquisar, ler e perguntar",
    intro: [
      "A Yamalé combina uma biblioteca jurídica africana pesquisável com pesquisa jurídica por IA sobre o mesmo corpus. Explore estatutos por país e categoria, abra textos integrais e faça perguntas de seguimento na Pesquisa IA com citações aos instrumentos em que está a trabalhar.",
      "Para estudantes de direito, o fluxo de trabalho apoia a preparação para exames e trabalhos académicos: encontre a lei, leia os artigos e teste a sua compreensão com perguntas e respostas citadas. Para escritórios e equipas internas, reduz o tempo gasto a procurar PDFs em várias jurisdições.",
      "A biblioteca é a fonte de verdade. A IA é uma camada por cima — útil para orientação e identificação de questões, e não um substituto da leitura de fontes primárias ou de aconselhamento profissional.",
    ],
    features: [
      {
        title: "Corpus unificado",
        body: "A pesquisa IA e a navegação na biblioteca baseiam-se na mesma coleção crescente de textos jurídicos africanos.",
      },
      {
        title: "Filtrar por jurisdição",
        body: "Refine por país, categoria e estado antes de pesquisar ou fazer perguntas à IA.",
      },
      {
        title: "Da citação ao texto integral",
        body: "Abra as leis citadas diretamente a partir dos cartões de fontes da pesquisa IA quando precisar do instrumento completo.",
      },
      {
        title: "Cofre e aconselhamento",
        body: "Combine o trabalho na biblioteca e com IA com modelos do Cofre Yamalé e o diretório de advogados.",
      },
    ],
    faqs: [
      {
        question: "Quantos países a biblioteca jurídica Yamalé cobre?",
        answer:
          "A plataforma foi concebida para ampla cobertura africana em 54 países, com profundidade variável por jurisdição e tema. Utilize os filtros da biblioteca para ver o que está disponível hoje para um determinado país.",
      },
      {
        question: "Posso usar a biblioteca sem IA?",
        answer:
          "Sim. A navegação na biblioteca está disponível nos planos gratuitos e pagos. A pesquisa IA requer um plano que inclua consultas IA.",
      },
      {
        question: "A IA pesquisa em toda a internet?",
        answer:
          "Não. A pesquisa jurídica IA da Yamalé foi concebida para responder a partir de excertos da biblioteca (mais suplementos web limitados opcionais para orientação), e não da web aberta como direito vinculativo.",
      },
    ],
    relatedLinks: [
      { href: "/library", label: "Abrir a biblioteca jurídica" },
      { href: "/ai-research", label: "Pesquisa jurídica IA" },
      { href: "/ai-legal-search-africa", label: "Pesquisa jurídica por IA na África" },
      { href: "/pricing", label: "Planos e preços" },
    ],
  },
};
